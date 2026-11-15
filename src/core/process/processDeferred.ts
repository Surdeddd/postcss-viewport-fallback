import type {
  AnyNode,
  AtRule,
  ChildNode,
  Container,
  Declaration,
  Helpers,
  Rule,
} from 'postcss';
import type { ResolvedConfig } from '../config';
import { CSS_VAR_PREFIX } from '../constants';
import { markUnitsUsed } from '../context';
import { SWITCH_OFF } from '../controlComments';
import type {
  CustomSlot,
  GuardGroup,
  GuardPlacement,
  GuardSlot,
  RunContext,
} from '../context';
import { isCustomProperty, sameProperty } from '../escape';
import { indentOf, newlineOf } from '../format';
import { t } from '../messages';
import { hasSubstitution, transformValue } from '../parser';
import type { FallbackStrategy, ValueTransform } from '../parser';
import { createFootprint } from '../properties';
import { revisit, unproxy } from '../proxy';
import { isFragment } from '../seed';
import { isGuardedBySupports, supportsCondition } from '../supports';
import { announce, assertNotStrict, terminalValue } from './shared';

/** A declaration on its way into `@supports`: one value and one condition per ladder step. */
interface Upgrade {
  node: Declaration;
  isCustom: boolean;
  values: string[];
  conditions: string[];
  /** How high each condition stands among the probes; a weaker step is always lower. */
  levels: number[];
  key: string;
  fallback: string;
  trailing: string;
  /** The later declarations whose order with the guarded one, or with each other, can matter. */
  followers: Declaration[];
  /** Followers this plugin lowers itself later in the walk; their copies wait for that. */
  waiting: Set<Declaration>;
  /** Followers a control comment switches off; their copies stay switched off. */
  switchedOff: Set<Declaration>;
  /** Whether a declaration elsewhere can meet the guarded one or a follower. */
  meets: (other: Declaration) => boolean;
}

function isKeyframe(rule: Rule): boolean {
  const parent = rule.parent;
  return parent?.type === 'atrule' && /keyframes$/i.test(parent.name);
}

/**
 * True for `initial-value` of `@property`. Every value parses there, and one the browser cannot
 * read afterwards voids the whole registration, so a twin in front of it is never used.
 */
export function isRegisteredInitial(decl: Declaration): boolean {
  const parent = decl.parent;
  return (
    parent?.type === 'atrule' &&
    parent.name.toLowerCase() === 'property' &&
    sameProperty(decl.prop, 'initial-value')
  );
}

/** The rule that takes no `@supports` inside and has to be repeated as a whole. */
function repeatedRuleOf(node: Declaration): AtRule | undefined {
  const host = node.parent!;
  if (isRegisteredInitial(node)) return host as AtRule;
  return host.type === 'rule' && isKeyframe(host) ? (host.parent as AtRule) : undefined;
}

/** True when the declarations of this container end up inside a style rule. */
function isRuleBody(container: AnyNode, fragments: boolean): boolean {
  let node = container;
  while (node.type !== 'rule' && node.type !== 'root') node = node.parent as AnyNode;
  return node.type === 'rule' ? !isKeyframe(node) : fragments && isFragment(node);
}

function isOverridden(node: Declaration, later: readonly ChildNode[]): boolean {
  return later.some(
    (sibling) =>
      sibling.type === 'decl' &&
      sameProperty(sibling.prop, node.prop) &&
      (sibling.important || !node.important)
  );
}

/** Where the `@supports` upgrade can go without changing which declaration wins. */
function guardPlacement(
  node: Declaration,
  meets: Upgrade['meets'],
  generated: WeakSet<ChildNode>,
  fragments: boolean
): GuardPlacement {
  const host = node.parent as AnyNode;
  if (!isRuleBody(host, fragments)) return 'impossible';

  const siblings = node.parent!.nodes;
  const index = siblings.indexOf(node);
  const interacts = (sibling: ChildNode): boolean => {
    if (
      (sibling.type !== 'rule' && sibling.type !== 'atrule') ||
      generated.has(sibling)
    ) {
      return false;
    }
    let found = false;
    sibling.walkDecls((other) => {
      found = meets(other);
      return found ? false : undefined;
    });
    return found;
  };
  if (siblings.slice(0, index).some(interacts)) return 'impossible';
  if (host.type !== 'rule') return 'nested';
  return siblings.slice(index + 1).some(interacts) ? 'nested' : 'after-rule';
}

/** The first lowering of a declaration, unless a filter or an `@supports` around it rules it out. */
function loweringOf(
  decl: Declaration,
  config: ResolvedConfig,
  ctx: RunContext
): ValueTransform | null {
  if (!config.allows(decl.prop)) return null;

  const transformed = transformValue(decl.value, config, 'duplicate');
  const guarded =
    transformed !== null &&
    isGuardedBySupports(decl, transformed.units, config, ctx.supportsCache);
  return guarded ? null : transformed;
}

/** The first lowering of a late-validated declaration this plugin is allowed to touch. */
function pendingUpgrade(
  decl: Declaration,
  config: ResolvedConfig,
  ctx: RunContext
): ValueTransform | null {
  const lateValidated = isCustomProperty(decl.prop)
    ? config.includeCustomProps && !decl.prop.startsWith(CSS_VAR_PREFIX)
    : hasSubstitution(decl.value) || isRegisteredInitial(decl);
  if (!lateValidated || ctx.comments.isDisabled(decl)) return null;
  return loweringOf(decl, config, ctx);
}

/** The steps of a value, most capable first, and what is left when none of them is supported. */
interface Ladder {
  values: string[];
  units: string[][];
  levels: number[];
  fallback: string;
}

function ladderOf(value: string, first: ValueTransform, config: ResolvedConfig): Ladder {
  const ladder: Ladder = { values: [], units: [], levels: [], fallback: '' };
  for (let step: ValueTransform | null = first; step;) {
    ladder.values.push(value.trimEnd());
    ladder.units.push(step.units);
    ladder.levels.push(Math.max(...step.units.map((unit) => config.levels.get(unit)!)));
    value = step.value;
    step = transformValue(value, config, 'duplicate');
  }
  ladder.fallback = value.trimEnd();
  return ladder;
}

/** Every value from the original down to (excluding) the terminal fallback, plus that fallback. */
function upgradeOf(
  node: Declaration,
  isCustom: boolean,
  first: ValueTransform,
  later: readonly ChildNode[],
  config: ResolvedConfig,
  ctx: RunContext
): Upgrade {
  const { values, units, levels, fallback } = ladderOf(node.value, first, config);
  const conditions = units.map((step) => supportsCondition(step, config.probes));

  const followers: Declaration[] = [];
  const waiting = new Set<Declaration>();
  const switchedOff = new Set<Declaration>();
  const footprint = createFootprint();
  const reaches = (other: Declaration): boolean =>
    !isCustomProperty(other.prop) && footprint.touches(other.prop);
  if (!isCustom) footprint.add(node.prop);
  for (const sibling of isCustom ? [] : later) {
    if (sibling.type === 'comment') ctx.comments.observe(sibling);
    if (sibling.type !== 'decl' || !reaches(sibling)) continue;
    footprint.add(sibling.prop);
    followers.push(sibling);
    if (ctx.comments.isDisabled(sibling)) switchedOff.add(sibling);
    else if (pendingUpgrade(sibling, config, ctx)) waiting.add(sibling);
  }

  return {
    node,
    isCustom,
    values,
    conditions,
    levels,
    key: conditions.join(' | '),
    fallback,
    trailing: node.value.slice(node.value.trimEnd().length),
    followers,
    waiting,
    switchedOff,
    meets: isCustom ? (other) => sameProperty(other.prop, node.prop) : reaches,
  };
}

/**
 * True for a node made in code, with no whitespace of its own. What is written for it gets
 * none either: PostCSS then prints everything in one style, semicolons included, and takes
 * no sample from it.
 */
function isUnformatted(node: ChildNode): boolean {
  return node.raws.before === undefined;
}

/** Whether the author ends a block with a semicolon, judged by the last block closed in this one. */
function closesWithSemicolon(block: Container): boolean {
  const last = block.last;
  const inner = last && last.type !== 'decl' && last.type !== 'comment' && last.nodes;
  return inner ? closesWithSemicolon(last) : (block.raws.semicolon ?? false);
}

/** The copy of a waiting follower stays as it is until its source is lowered. */
function rememberCopy(source: Declaration, copy: Declaration, ctx: RunContext): void {
  ctx.waiting.add(copy);
  const copies = ctx.followerCopies.get(source);
  if (copies) copies.push(copy);
  else ctx.followerCopies.set(source, [copy]);
}

/** Copies of a declaration that stays as it is have to find their fallback on their own. */
function releaseCopies(node: Declaration, ctx: RunContext): void {
  for (const copy of ctx.followerCopies.get(node) ?? []) {
    ctx.waiting.delete(copy);
    revisit(copy);
  }
}

/** A copy the plugin would lower, of a declaration it must not touch, gets a comment of its own. */
function switchOff(
  copy: Declaration,
  ctx: RunContext,
  { Comment: CommentNode }: Helpers
): void {
  const comment = new CommentNode({
    text: SWITCH_OFF,
    source: copy.source,
    raws: { left: ' ', right: ' ' },
  });
  copy.before(comment);
  ctx.handled.set(copy, comment);
}

/** What this run wrote first in front of a declaration, or the declaration itself. */
function headOf(decl: Declaration, ctx: RunContext): ChildNode {
  let head: ChildNode = decl;
  for (let twin = ctx.handled.get(head); twin?.parent; twin = ctx.handled.get(twin)) {
    head = twin;
  }
  return head;
}

/** Hold the guarded value and its followers, each of them once, all copies in source order. */
function fillSlot(
  slot: GuardSlot,
  { node, followers, waiting, switchedOff }: Upgrade,
  value: string,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  const siblings = node.parent!.nodes;
  let due = followers.length - 1;
  let next: Declaration | undefined;
  for (let i = siblings.length - 1; ; i--) {
    const source = siblings[i] as Declaration;
    const wanted = source === node || source === followers[due];
    let copy = slot.held.get(source);
    if (copy?.parent !== slot.body) copy = undefined;
    if (wanted && !copy) {
      copy = source.clone();
      if (slot.declBefore !== undefined) copy.raws.before = slot.declBefore;
      if (next) headOf(next, ctx).before(copy);
      else slot.body.append(copy);
      slot.held.set(source, copy);
      if (waiting.has(source)) rememberCopy(source, copy, ctx);
      if (switchedOff.has(source) && loweringOf(copy, config, ctx)) {
        switchOff(copy, ctx, helpers);
      }
    }
    next = copy ?? next;
    if (source === node) {
      copy!.value = value;
      return;
    }
    if (wanted) due--;
  }
}

/** Write every step of a declaration into its guards; its copies elsewhere get the fallback. */
function fillSlots(
  slots: GuardSlot[],
  upgrade: Upgrade,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  const { node, fallback, values } = upgrade;
  for (const copy of ctx.followerCopies.get(node) ?? []) {
    copy.value = fallback;
    ctx.waiting.delete(copy);
  }
  slots.forEach((slot, step) =>
    fillSlot(slot, upgrade, values[step], config, ctx, helpers)
  );
}

function buildRuleGuard(
  rule: Rule,
  { node, trailing }: Upgrade,
  condition: string,
  { AtRule: AtRuleNode, Rule: RuleNode }: Helpers
): GuardSlot {
  const between = rule.raws.between ?? ' ';
  const ruleBefore = rule.raws.before ?? '';
  const declBefore = node.raws.before ?? '';
  const guard = new AtRuleNode({
    name: 'supports',
    params: condition,
    source: rule.source,
  });
  const inner = new RuleNode({ selector: rule.selector, source: rule.source });
  let innerDeclBefore: string | undefined;

  if (declBefore.includes('\n')) {
    const indent = indentOf(ruleBefore);
    const step = indentOf(declBefore).slice(indent.length) || '  ';
    const guardLine = newlineOf(declBefore) + indent;
    const innerLine = guardLine + step;
    guard.raws = { before: guardLine, between, afterName: ' ', after: guardLine };
    inner.raws = { before: innerLine, between, after: innerLine, semicolon: true };
    innerDeclBefore = innerLine + step;
  } else if (!isUnformatted(node)) {
    const gap = rule.raws.after || trailing;
    const neighbour = ruleBefore || (rule.next()?.raws.before ?? (between ? '\n' : ''));
    const before = neighbour.includes('\n')
      ? newlineOf(neighbour) + indentOf(neighbour)
      : neighbour;
    guard.raws = { before, between, afterName: ' ', after: gap };
    inner.raws = {
      before: gap,
      between,
      after: gap,
      semicolon: closesWithSemicolon(rule),
    };
  }

  guard.append(inner);
  return {
    guard,
    body: inner,
    declBefore: innerDeclBefore,
    held: new Map(),
  };
}

/** Push the lines of a copied block one indentation step to the right. */
function indentDeeper(container: Container, step: string): void {
  const shift = (raws: { before?: string; after?: string }): void => {
    if (raws.before?.includes('\n')) raws.before += step;
    if (raws.after?.includes('\n')) raws.after += step;
  };
  shift(container.raws);
  container.walk((node) => shift(node.raws));
}

/**
 * `@rule` and `@property` cannot hold an `@supports` block, so the whole rule is repeated
 * under one: the later rule of the same name wins wherever the units are supported. A chain of
 * units gets one copy per step, weakest first; each copy holds every value at the best step it
 * proves.
 */
function repeatRule(
  rule: AtRule,
  config: ResolvedConfig,
  ctx: RunContext,
  { AtRule: AtRuleNode }: Helpers
): void {
  if (ctx.repeated.has(rule)) return;

  rule.walkComments((comment) => ctx.comments.observe(comment));
  const sources: Declaration[] = [];
  rule.walkDecls((decl) => void sources.push(decl));
  const ladders = sources.map((source) => {
    const first = pendingUpgrade(source, config, ctx);
    return first && ladderOf(source.value, first, config);
  });
  const stages = [...new Set(ladders.flatMap((ladder) => ladder?.levels ?? []))].sort(
    (a, b) => a - b
  );

  const own = rule.raws.before ?? '';
  const between = rule.raws.between ?? ' ';
  const inner = rule.first!.raws.before ?? '';
  const neighbour = own || (rule.next()?.raws.before ?? (between ? '\n' : ''));
  const before = neighbour.includes('\n')
    ? newlineOf(neighbour) + indentOf(neighbour)
    : neighbour;

  let after: AtRule = rule;
  for (const stage of stages) {
    const copy = rule.clone();
    const copies: Declaration[] = [];
    copy.walkDecls((decl) => void copies.push(decl));
    const units = new Set<string>();

    ladders.forEach((ladder, i) => {
      if (!ladder) return;
      const step = ladder.levels.findIndex((level) => level <= stage);
      if (step === -1) copies[i].value = ladder.fallback;
      else {
        if (step > 0) copies[i].value = ladder.values[step];
        for (const unit of ladder.units[step]) units.add(unit);
      }
    });

    const guard = new AtRuleNode({
      name: 'supports',
      params: supportsCondition([...units], config.probes),
      source: rule.source,
    });
    if (inner.includes('\n')) {
      const indent = indentOf(own);
      const step = indentOf(inner).slice(indent.length) || '  ';
      const line = newlineOf(inner) + indent;
      guard.raws = { before, between, afterName: ' ', after: line };
      indentDeeper(copy, step);
      copy.raws.before = line + step;
    } else if (!isUnformatted(rule.first!)) {
      guard.raws = { before, between, afterName: ' ', after: between };
      copy.raws.before = between;
    }

    guard.append(copy);
    after.after(guard);
    after = guard;
    ctx.generated.add(guard);
  }
  ctx.repeated.add(rule);
}

/** Guard after the rule, shared with the declarations right before it that climb the same ladder. */
function guardAfterRule(
  rule: Rule,
  upgrade: Upgrade,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  const { conditions, key } = upgrade;
  const state = ctx.ruleGuards.get(rule) ?? { groups: [], customSlots: [], tail: rule };
  ctx.ruleGuards.set(rule, state);

  const create = (condition: string, place: (guard: AtRule) => void): GuardSlot => {
    const slot = buildRuleGuard(rule, upgrade, condition, helpers);
    place(slot.guard);
    ctx.generated.add(slot.guard);
    return slot;
  };
  const atTheEnd = (guard: AtRule): void => {
    state.tail.after(guard);
    state.tail = guard;
  };

  if (upgrade.isCustom) {
    const slots = conditions.map((condition, step) => {
      const known = state.customSlots.find((entry) => entry.condition === condition);
      if (known) return known.slot;

      const level = upgrade.levels[step];
      const above = state.customSlots.findIndex((entry) => entry.level > level);
      const at = above === -1 ? state.customSlots.length : above;
      const next = state.customSlots[at] as CustomSlot | undefined;
      const slot = create(
        condition,
        next ? (guard) => void next.slot.guard.before(guard) : atTheEnd
      );
      state.customSlots.splice(at, 0, { condition, level, slot });
      return slot;
    });
    fillSlots(slots, upgrade, config, ctx, helpers);
    return;
  }

  let group = state.groups[state.groups.length - 1] as GuardGroup | undefined;
  if (group?.key !== key) {
    const slots: GuardSlot[] = [];
    for (let step = conditions.length - 1; step >= 0; step--) {
      slots[step] = create(conditions[step], atTheEnd);
    }
    group = { key, slots };
    state.groups.push(group);
  }
  fillSlots(group.slots, upgrade, config, ctx, helpers);
}

/** True when nothing but declarations stands between a group's guards and a later declaration. */
function adjoins(group: GuardGroup, node: Declaration): boolean {
  const siblings = node.parent!.nodes;
  const guards: ChildNode[] = group.slots.map((slot) => slot.guard);
  const first = siblings.indexOf(guards[guards.length - 1]);
  return siblings
    .slice(first + 1, siblings.indexOf(node))
    .every(
      (sibling) =>
        sibling.type === 'decl' || sibling.type === 'comment' || guards.includes(sibling)
    );
}

/** Guard nested right after the declaration, shared with its neighbours that climb the same ladder. */
function guardInPlace(
  upgrade: Upgrade,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  const { AtRule: AtRuleNode } = helpers;
  const { node, conditions, key, trailing } = upgrade;
  const host = node.parent!;
  const open = ctx.nestedGuards.get(host);
  let after: ChildNode = node;

  if (open?.key === key && adjoins(open, node)) {
    for (let step = open.slots.length - 1; step >= 0; step--) {
      after.after(open.slots[step].guard);
      after = open.slots[step].guard;
    }
    fillSlots(open.slots, upgrade, config, ctx, helpers);
    return;
  }

  const inFragment = host.type === 'root';
  const between = host.raws.between ?? ' ';
  const ownBefore = node.raws.before ?? '';
  const sample = ownBefore || (inFragment ? (node.next()?.raws.before ?? '') : '');
  const multiline = sample.includes('\n');
  const spaced = inFragment && node.raws.between !== ':';
  const lead = sample || (spaced ? ' ' : '');
  const step = indentOf(sample).slice(indentOf(host.raws.before ?? '').length) || '  ';
  const innerBefore = multiline ? lead + step : inFragment ? lead : undefined;
  const slots: GuardSlot[] = [];

  for (let i = conditions.length - 1; i >= 0; i--) {
    const guard = new AtRuleNode({
      name: 'supports',
      params: conditions[i],
      source: node.source,
    });
    if (inFragment || !isUnformatted(node)) {
      guard.raws = {
        before: lead,
        between,
        afterName: ' ',
        after: multiline || inFragment ? lead : host.raws.after || trailing,
        semicolon: multiline || closesWithSemicolon(host),
      };
    }
    after.after(guard);
    ctx.generated.add(guard);
    slots[i] = {
      guard,
      body: guard,
      declBefore: innerBefore,
      held: new Map(),
    };
    after = guard;
  }

  const group: GuardGroup = { key, slots };
  ctx.nestedGuards.set(host, group);
  fillSlots(group.slots, upgrade, config, ctx, helpers);
}

/** Swap a late-validated value for its fallback; the original moves into `@supports`. */
export function processDeferred(
  decl: Declaration,
  transformed: ValueTransform,
  strategy: FallbackStrategy,
  isCustom: boolean,
  config: ResolvedConfig,
  ctx: RunContext,
  helpers: Helpers
): void {
  const node = unproxy(decl);
  const prop = node.prop;
  const original = node.value.trimEnd();
  const subject = `${prop}: ${original}`;

  if (strategy === 'css-var' || !config.preserve) {
    const rewritten =
      strategy === 'css-var' ? transformed.value : terminalValue(node.value, config);
    assertNotStrict(config, node, subject, original);
    if (strategy === 'css-var') markUnitsUsed(ctx, node, transformed.units);
    announce(config, ctx, node, prop, original, rewritten.trimEnd());
    decl.value = rewritten;
    ctx.stats.declarations++;
    return;
  }

  const host = node.parent!;
  const siblings = host.nodes;
  const later = siblings.slice(siblings.indexOf(node) + 1);
  if (isCustom && isOverridden(node, later)) return;

  assertNotStrict(config, node, subject, original);
  const repeated = repeatedRuleOf(node);
  const upgrade = upgradeOf(node, isCustom, transformed, later, config, ctx);
  const placement: GuardPlacement = repeated
    ? 'after-rule'
    : guardPlacement(node, upgrade.meets, ctx.generated, config.fragmentGuards);

  if (placement === 'impossible') {
    ctx.result.warn(t('noGuardPossible', { prop }), { node });
    releaseCopies(node, ctx);
    return;
  }

  if (repeated) repeatRule(repeated, config, ctx, helpers);
  else if (placement === 'nested') guardInPlace(upgrade, config, ctx, helpers);
  else guardAfterRule(host as Rule, upgrade, config, ctx, helpers);

  const { fallback, trailing } = upgrade;
  announce(config, ctx, node, prop, original, fallback);
  ctx.stats.declarations++;

  const staysLast = placement === 'after-rule';
  if (trailing && !staysLast) host.raws.after = trailing;
  decl.value = staysLast ? fallback + trailing : fallback;
}

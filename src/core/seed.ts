import type { ChildNode, Container, Result, Root } from 'postcss';
import { CSS_VAR_PREFIX } from './constants';
import { indentOf, newlineOf } from './format';
import { t } from './messages';
import type { UnitTables } from './parser';
import { supportsCondition } from './supports';
import { fallbackChain } from './units';

const SEED_SELECTOR = ':root, :host';
const PREAMBLE_AT_RULES = new Set(['charset', 'import', 'namespace', 'use', 'forward']);

/** False for style attributes and for fragments that are spliced into a rule later. */
export function isStylesheet(root: Root): boolean {
  if ((root.source as { inline?: boolean } | undefined)?.inline) return false;
  return !root.nodes.some(
    (node) =>
      (node.type === 'decl' && !node.prop.startsWith('$')) ||
      (node.type === 'rule' && node.selector.trimStart().startsWith('&'))
  );
}

function seededUnits(host: Root): Set<string> {
  const seeded = new Set<string>();
  for (const node of host.nodes) {
    if (node.type !== 'rule' || !/^:root\b/.test(node.selector)) continue;
    node.each((child) => {
      if (child.type === 'decl' && child.prop.startsWith(CSS_VAR_PREFIX)) {
        seeded.add(child.prop.slice(CSS_VAR_PREFIX.length));
      }
    });
  }
  return seeded;
}

function preambleEnd(host: Root): ChildNode | undefined {
  let end: ChildNode | undefined;
  for (const node of host.nodes) {
    if (node.type === 'comment') {
      if (node.text.startsWith('!')) end = node;
    } else if (node.type === 'atrule' && PREAMBLE_AT_RULES.has(node.name.toLowerCase())) {
      end = node;
    } else if (
      node.type !== 'atrule' ||
      node.name.toLowerCase() !== 'layer' ||
      node.nodes
    ) {
      break;
    }
  }
  return end;
}

/** The base rule and, weakest first, one `@supports` block per probe with every variable it proves. */
function seedLines(
  units: readonly string[],
  { unitMap, probes, levels }: UnitTables
): string[] {
  const base: string[] = [];
  const upgrades = new Map<string, { level: number; declarations: string[] }>();
  for (const unit of units) {
    const [terminal, ...steps] = fallbackChain(unit, unitMap);
    base.push(`${CSS_VAR_PREFIX}${unit}: 1${terminal}`);
    for (const step of steps) {
      const name = step.toLowerCase();
      const condition = supportsCondition([name], probes);
      const block = upgrades.get(condition) ?? {
        level: levels.get(name)!,
        declarations: [],
      };
      block.declarations.push(`${CSS_VAR_PREFIX}${unit}: 1${step}`);
      upgrades.set(condition, block);
    }
  }
  return [
    `${SEED_SELECTOR} { ${base.join('; ')} }`,
    ...[...upgrades]
      .sort(([, a], [, b]) => a.level - b.level)
      .map(
        ([condition, { declarations }]) =>
          `@supports ${condition} { ${SEED_SELECTOR} { ${declarations.join('; ')} } }`
      ),
  ];
}

function seedStylesheet(
  host: Root,
  units: ReadonlySet<string>,
  tables: UnitTables
): void {
  const seeded = seededUnits(host);
  const missing = [...units].filter((unit) => !seeded.has(unit)).sort();
  if (missing.length === 0) return;

  const anchor = preambleEnd(host);
  const following = anchor ? anchor.next() : host.first;
  const followingBefore = following?.raws.before ?? '';
  const reference = following ? followingBefore : (anchor?.raws.before ?? '');
  const lineBreak = newlineOf(reference) + indentOf(reference);

  const seed = seedLines(missing, tables).join('\n');
  if (anchor) host.insertAfter(anchor, seed);
  else host.prepend(seed);

  let node = anchor ? anchor.next() : host.first;
  for (
    let first = !anchor;
    node && node !== following;
    node = node.next(), first = false
  ) {
    node.raws.before = first ? followingBefore : lineBreak;
    node.source = host.source;
    (node as Container).walk((child) => {
      child.source = host.source;
    });
  }
  if (following && (!anchor || !followingBefore.includes('\n'))) {
    following.raws.before = lineBreak;
  }
}

/** True for the declarations of a rule kept apart from it, as CSS-in-JS templates are. */
export function isFragment(root: Root): boolean {
  return (
    !isStylesheet(root) && !(root.source as { inline?: boolean } | undefined)?.inline
  );
}

/** Give each stylesheet the `--pvf-*` seed it needs; seedless roots use the first one. */
export function injectSeeds(
  result: Result,
  usedUnits: ReadonlyMap<Root, ReadonlySet<string>>,
  tables: UnitTables
): void {
  const top = result.root;
  const firstStylesheet = (top.type === 'document' ? top.nodes : [top]).find(
    isStylesheet
  );
  const bySheet = new Map<Root, Set<string>>();
  const homeless = new Set<string>();

  for (const [root, units] of usedUnits) {
    const target = isStylesheet(root) ? root : firstStylesheet;
    if (!target) {
      for (const unit of units) homeless.add(unit);
      continue;
    }
    const collected = bySheet.get(target) ?? new Set<string>();
    for (const unit of units) collected.add(unit);
    bySheet.set(target, collected);
  }

  for (const [sheet, units] of bySheet) seedStylesheet(sheet, units, tables);
  if (homeless.size > 0) result.warn(t('noSeedHost'));
}

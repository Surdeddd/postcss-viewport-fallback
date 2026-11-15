import type { AnyNode, ChildNode } from 'postcss';
import valueParser from 'postcss-value-parser';
import type { Node as ValueNode } from 'postcss-value-parser';
import { hasSubstitution, transformValue } from './parser';
import type { ResolvedConfig } from './config';
import type { UnitMap } from './units';

function isColon(node: ValueNode): boolean {
  return node.type === 'div' && node.value === ':';
}

/** What a condition settles: the probes that hold when it is true, and those that hold when it is false. */
interface Proof {
  yes: ReadonlySet<string>;
  no: ReadonlySet<string>;
}

const NOTHING: Proof = { yes: new Set(), no: new Set() };

function union(sets: ReadonlyArray<ReadonlySet<string>>): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

function intersection(sets: ReadonlyArray<ReadonlySet<string>>): Set<string> {
  return new Set([...sets[0]].filter((probe) => sets.every((set) => set.has(probe))));
}

/** `(property: value)` proves its units; a group in parentheses is a condition of its own. */
function proofInParens(node: ValueNode, params: string, config: ResolvedConfig): Proof {
  if (node.type !== 'function' || node.value !== '') return NOTHING;

  const colon = node.nodes.find(isColon);
  if (!colon) return proofOf(node.nodes, params, config);

  const property = node.nodes.find((child) => child.type === 'word');
  const value = params.slice(colon.sourceEndIndex, node.sourceEndIndex);
  if (!property || property.value.startsWith('--') || hasSubstitution(value)) {
    return NOTHING;
  }
  const units = transformValue(value, config, 'duplicate')?.units ?? [];
  return { yes: new Set(units.map((unit) => config.probes.get(unit)!)), no: NOTHING.no };
}

/**
 * `not A` swaps the two sides of A; `A and B` is true only when both are, `A or B` false only
 * when both are. Anything that is not a well-formed condition settles nothing.
 */
function proofOf(nodes: ValueNode[], params: string, config: ResolvedConfig): Proof {
  const parts = nodes.filter((node) => node.type !== 'space' && node.type !== 'comment');
  const keyword = (node: ValueNode | undefined): string =>
    node?.type === 'word' ? node.value.toLowerCase() : '';

  if (keyword(parts[0]) === 'not') {
    if (parts.length !== 2) return NOTHING;
    const { yes, no } = proofInParens(parts[1], params, config);
    return { yes: no, no: yes };
  }

  const operator = parts.length > 1 ? keyword(parts[1]) : 'and';
  const wellFormed =
    parts.length % 2 === 1 &&
    (operator === 'and' || operator === 'or') &&
    parts.every((part, index) => index % 2 === 0 || keyword(part) === operator);
  if (!wellFormed) return NOTHING;

  const operands = parts
    .filter((_, index) => index % 2 === 0)
    .map((part) => proofInParens(part, params, config));
  const yes = operands.map((operand) => operand.yes);
  const no = operands.map((operand) => operand.no);
  return operator === 'and'
    ? { yes: union(yes), no: intersection(no) }
    : { yes: intersection(yes), no: union(no) };
}

/** Probe units an `@supports` prelude requires for its block to apply at all. */
function requiredProbes(params: string, config: ResolvedConfig): readonly string[] {
  if (!config.quickTest.test(params) || params.includes('\\')) return [];
  return [...proofOf(valueParser(params).nodes, params, config).yes];
}

/** True when enclosing `@supports` rules already require every listed unit. */
export function isGuardedBySupports(
  node: ChildNode,
  units: readonly string[],
  config: ResolvedConfig,
  cache: Map<string, readonly string[]>
): boolean {
  let missing = units.map((unit) => config.probes.get(unit)!);
  let parent = node.parent as AnyNode | undefined;
  for (; parent && missing.length > 0; parent = parent.parent as AnyNode | undefined) {
    if (parent.type !== 'atrule' || parent.name.toLowerCase() !== 'supports') continue;

    let required = cache.get(parent.params);
    if (!required) {
      required = requiredProbes(parent.params, config);
      cache.set(parent.params, required);
    }
    if (required.length > 0) {
      const guarded = required;
      missing = missing.filter((probe) => !guarded.includes(probe));
    }
  }
  return missing.length === 0;
}

/** `@supports` prelude that holds exactly when every listed unit is supported. */
export function supportsCondition(units: readonly string[], probes: UnitMap): string {
  return [...new Set(units.map((unit) => probes.get(unit)!))]
    .sort()
    .map((probe) => `(height: 1${probe})`)
    .join(' and ');
}

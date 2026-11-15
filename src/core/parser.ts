import valueParser from 'postcss-value-parser';
import { CSS_VAR_PREFIX } from './constants';
import type { UnitMap } from './units';

export type FallbackStrategy = 'duplicate' | 'css-var';

export interface UnitTables {
  dimension: RegExp;
  unitMap: UnitMap;
  terminals: UnitMap;
  probes: UnitMap;
  levels: ReadonlyMap<string, number>;
}

export interface ValueTransform {
  value: string;
  units: string[];
}

const SUBSTITUTION = /(?:^|[^\w-])(?:var|env)\(/i;
const OPAQUE_FUNCTIONS = new Set(['url', 'style']);

/** True for values a browser validates only after substituting var() / env(). */
export function hasSubstitution(value: string): boolean {
  return SUBSTITUTION.test(value);
}

/** Rewrite every mapped dimension in a value or at-rule prelude; null when nothing matched. */
export function transformValue(
  value: string,
  tables: UnitTables,
  strategy: FallbackStrategy
): ValueTransform | null {
  if (value.includes('\\')) return null;

  const units: string[] = [];
  let output = '';
  let cursor = 0;

  valueParser(value).walk((node) => {
    if (node.type === 'function') {
      return OPAQUE_FUNCTIONS.has(node.value.toLowerCase()) ? false : undefined;
    }
    if (node.type !== 'word') return undefined;

    const rewritten = node.value.replace(
      tables.dimension,
      (_match, number: string, rawUnit: string) => {
        const unit = rawUnit.toLowerCase();
        if (!units.includes(unit)) units.push(unit);
        return strategy === 'css-var'
          ? `calc(var(${CSS_VAR_PREFIX}${unit}, 1${tables.terminals.get(unit)}) * ${number})`
          : number + tables.unitMap.get(unit);
      }
    );
    if (rewritten !== node.value) {
      output += value.slice(cursor, node.sourceIndex) + rewritten;
      cursor = node.sourceEndIndex;
    }
    return undefined;
  });

  return units.length > 0 ? { value: output + value.slice(cursor), units } : null;
}

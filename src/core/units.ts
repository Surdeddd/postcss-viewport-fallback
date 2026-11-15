import { t } from './messages';

export type UnitMap = ReadonlyMap<string, string>;

const VARIANTS = ['d', 's', 'l'];
const CLASSIC_UNITS = ['vw', 'vh', 'vi', 'vb', 'vmin', 'vmax'];

const PHYSICAL_AXIS: Readonly<Record<string, string>> = { vi: 'vw', vb: 'vh' };

const BUILT_IN_NAMES: readonly string[] = VARIANTS.flatMap((variant) =>
  CLASSIC_UNITS.map((unit) => variant + unit)
);

/** `dvh → vh` and friends; logical units go to `vi`/`vb`, or to `vw`/`vh` when `physical`. */
function builtInUnits(physical: boolean): Array<[string, string]> {
  return VARIANTS.flatMap((variant) =>
    CLASSIC_UNITS.map((unit): [string, string] => [
      variant + unit,
      (physical && PHYSICAL_AXIS[unit]) || unit,
    ])
  );
}

const UNIT_NAME = /^[a-z]+$/i;
const FALLBACK_UNIT = /^(?:[a-z]+|%)$/i;

function normalizeCustomUnits(custom: Record<string, string>): Array<[string, string]> {
  return Object.entries(custom).map(([unit, fallback]) => {
    if (!UNIT_NAME.test(unit)) {
      throw new Error(t('invalidUnitKey', { key: JSON.stringify(unit) }));
    }
    if (typeof fallback !== 'string' || !FALLBACK_UNIT.test(fallback)) {
      throw new Error(
        t('invalidUnitFallback', {
          unit,
          value: JSON.stringify(fallback) ?? String(fallback),
        })
      );
    }
    return [unit.toLowerCase(), fallback];
  });
}

function assertNoCycles(units: UnitMap): void {
  for (const start of units.keys()) {
    const path = [start];
    for (let next = units.get(start); next !== undefined;) {
      const unit = next.toLowerCase();
      if (path.includes(unit)) {
        throw new Error(t('unitCycle', { path: [...path, unit].join(' → ') }));
      }
      path.push(unit);
      next = units.get(unit);
    }
  }
}

/** Built-in units (unless the targets support them) overlaid with validated custom ones. */
export function createUnitMap(
  custom: Record<string, string> | undefined,
  includeBuiltIns: boolean,
  physical = false
): Map<string, string> {
  const units = new Map<string, string>(includeBuiltIns ? builtInUnits(physical) : []);
  if (custom) {
    for (const [unit, fallback] of normalizeCustomUnits(custom))
      units.set(unit, fallback);
  }
  assertNoCycles(units);
  return units;
}

/**
 * Unit → the unit whose support proves it. The built-in units shipped together in every
 * browser, so they share one probe; a unit that `customUnits` defines speaks for itself.
 */
export function probeUnits(
  units: UnitMap,
  custom: Record<string, string> | undefined
): Map<string, string> {
  const redefined = new Set(Object.keys(custom ?? {}).map((unit) => unit.toLowerCase()));
  const family = BUILT_IN_NAMES.filter((unit) => units.has(unit) && !redefined.has(unit));
  const shared = family.includes('dvh') ? 'dvh' : family[0];
  const probes = new Map<string, string>();
  for (const unit of units.keys())
    probes.set(unit, family.includes(unit) ? shared : unit);
  return probes;
}

/**
 * The probes each unit's fallback chain climbs through, weakest first. A chain that would
 * need the shared probe at two of its steps cannot be put into `@supports` blocks.
 */
function probeLadders(units: UnitMap, probes: UnitMap): string[][] {
  return [...units.keys()].map((unit) => {
    const chain = fallbackChain(unit, units);
    const ladder = chain.slice(1).map((step) => probes.get(step.toLowerCase())!);
    if (new Set(ladder).size < ladder.length) {
      throw new Error(t('unitLoopsBack', { unit, path: chain.reverse().join(' → ') }));
    }
    return ladder;
  });
}

/**
 * Unit → the level of its probe. A probe stands above every probe that some fallback chain
 * puts below it, so `@supports` blocks ordered by level let the most capable value win.
 */
export function probeLevels(units: UnitMap, probes: UnitMap): Map<string, number> {
  const ladders = probeLadders(units, probes);
  const levels = new Map<string, number>();
  for (let changed = true; changed;) {
    changed = false;
    for (const ladder of ladders) {
      ladder.forEach((probe, index) => {
        const least = index === 0 ? 0 : levels.get(ladder[index - 1])! + 1;
        if ((levels.get(probe) ?? -1) < least) {
          levels.set(probe, least);
          changed = true;
        }
      });
    }
  }
  return new Map([...units.keys()].map((unit) => [unit, levels.get(probes.get(unit)!)!]));
}

/** Fallback chain ordered by capability: [terminal, ..., unit]. */
export function fallbackChain(unit: string, units: UnitMap): string[] {
  const chain = [unit];
  for (
    let next = units.get(unit);
    next !== undefined;
    next = units.get(next.toLowerCase())
  ) {
    chain.push(next);
  }
  return chain.reverse();
}

/** Every mapped unit paired with the last unit of its fallback chain. */
export function terminalUnits(units: UnitMap): Map<string, string> {
  const terminals = new Map<string, string>();
  for (const unit of units.keys()) terminals.set(unit, fallbackChain(unit, units)[0]);
  return terminals;
}

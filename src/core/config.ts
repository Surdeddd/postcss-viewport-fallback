import { dirname, resolve } from 'node:path';
import type {
  PropertyFilter,
  TransformMeta,
  TransformStats,
  ViewportFallbackOptions,
} from '../plugin/types';
import { targetsSupportViewportUnits } from './browserslist';
import type { BrowserslistQuery } from './browserslist';
import { t } from './messages';
import type { MessageKey } from './messages';
import type { FallbackStrategy, UnitTables } from './parser';
import { createPropertyGate } from './propertyFilter';
import type { PropertyMatcher } from './propertyFilter';
import { createDimensionRegex, createQuickTest } from './regex';
import { createUnitMap, probeLevels, probeUnits, terminalUnits } from './units';

/** Validated, normalized options plus everything derived from them. */
export interface ResolvedConfig extends UnitTables {
  active: boolean;
  strategy: FallbackStrategy;
  preserve: boolean;
  includeCustomProps: boolean;
  anyFallback: boolean;
  fragmentGuards: boolean;
  seed: boolean;
  strict: boolean;
  fastSkip: boolean;
  verbose: boolean;
  summary: boolean;
  quickTest: RegExp;
  allows: PropertyMatcher;
  onTransform: ((meta: TransformMeta) => void) | undefined;
  onComplete: ((stats: TransformStats) => void) | undefined;
}

/** The configuration that applies to a file; it varies only with `browserslist: true`. */
export interface PluginConfig {
  forFile(file: string | undefined): ResolvedConfig;
}

type RawOptions = Record<keyof ViewportFallbackOptions, unknown>;

const OPTION_NAMES: ReadonlySet<string> = new Set<keyof ViewportFallbackOptions>([
  'preserve',
  'includeCustomProps',
  'excludeProperties',
  'onlyProperties',
  'strategy',
  'logicalFallback',
  'existingFallback',
  'fragmentGuards',
  'seed',
  'debug',
  'strict',
  'customUnits',
  'browserslist',
  'fastSkip',
  'onTransform',
  'onComplete',
]);
const REMOVED_OPTIONS: Readonly<Record<string, string>> = { replace: 'preserve: false' };

function describe(value: unknown): string {
  if (typeof value === 'function') return 'function';
  if (value instanceof RegExp) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function invalid(name: string, expected: MessageKey, value: unknown): Error {
  return new Error(
    t('invalidOption', { name, expected: t(expected), received: describe(value) })
  );
}

function isPattern(value: unknown): value is string | RegExp {
  return typeof value === 'string' || value instanceof RegExp;
}

function readBoolean(options: RawOptions, name: keyof RawOptions): boolean | undefined {
  const value = options[name] ?? undefined;
  if (value !== undefined && typeof value !== 'boolean')
    throw invalid(name, 'expectBoolean', value);
  return value;
}

function readCallback<T>(
  options: RawOptions,
  name: keyof RawOptions
): ((arg: T) => void) | undefined {
  const value = options[name] ?? undefined;
  if (value !== undefined && typeof value !== 'function') {
    throw invalid(name, 'expectFunction', value);
  }
  return value as ((arg: T) => void) | undefined;
}

function readFilter(
  options: RawOptions,
  name: keyof RawOptions
): PropertyFilter | undefined {
  const value = options[name] ?? undefined;
  if (value === undefined) return undefined;
  const patterns = Array.isArray(value) ? value : [value];
  if (!patterns.every(isPattern)) throw invalid(name, 'expectFilter', value);
  return patterns;
}

function readChoice<T extends string>(
  options: RawOptions,
  name: keyof RawOptions,
  choices: readonly [T, T],
  expected: MessageKey
): T {
  const value = options[name] ?? choices[0];
  if (value !== choices[0] && value !== choices[1]) throw invalid(name, expected, value);
  return value as T;
}

function assertKnownOptions(options: object): void {
  for (const name of Object.keys(options)) {
    if (name in REMOVED_OPTIONS) {
      throw new Error(t('removedOption', { name, instead: REMOVED_OPTIONS[name] }));
    }
    if (!OPTION_NAMES.has(name)) throw new Error(t('unknownOption', { name }));
  }
}

function readDebug(options: RawOptions): { verbose: boolean; summary: boolean } {
  const value = options.debug ?? false;
  if (typeof value !== 'boolean' && value !== 'minimal' && value !== 'verbose') {
    throw invalid('debug', 'expectDebug', value);
  }
  return { verbose: value === true || value === 'verbose', summary: value !== false };
}

function readBrowserslist(options: RawOptions): BrowserslistQuery | false {
  const value = options.browserslist ?? false;
  const isQueryList =
    Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (typeof value !== 'boolean' && typeof value !== 'string' && !isQueryList) {
    throw invalid('browserslist', 'expectBrowserslist', value);
  }
  return value as BrowserslistQuery | false;
}

function readCustomUnits(options: RawOptions): Record<string, string> | undefined {
  const value = options.customUnits ?? undefined;
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalid('customUnits', 'expectUnits', value);
  }
  return value as Record<string, string>;
}

export function resolveConfig(
  input: ViewportFallbackOptions | null | undefined
): PluginConfig {
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) {
    throw new Error(t('invalidOptions', { received: describe(input) }));
  }
  const options = (input ?? {}) as RawOptions;
  assertKnownOptions(options);

  const strategy = readChoice(
    options,
    'strategy',
    ['duplicate', 'css-var'],
    'expectStrategy'
  );
  const logical = readChoice(
    options,
    'logicalFallback',
    ['physical', 'logical'],
    'expectLogicalFallback'
  );
  const existing = readChoice(
    options,
    'existingFallback',
    ['exact', 'any'],
    'expectExistingFallback'
  );
  const debug = readDebug(options);
  const preserve = readBoolean(options, 'preserve') ?? true;
  const includeCustomProps = readBoolean(options, 'includeCustomProps') ?? false;
  const fragmentGuards = readBoolean(options, 'fragmentGuards') ?? false;
  const seed = readBoolean(options, 'seed') ?? true;
  const strict = readBoolean(options, 'strict') ?? false;
  const fastSkip = readBoolean(options, 'fastSkip') ?? false;
  const only = readFilter(options, 'onlyProperties');
  const exclude = readFilter(options, 'excludeProperties');
  const onTransform = readCallback<TransformMeta>(options, 'onTransform');
  const onComplete = readCallback<TransformStats>(options, 'onComplete');
  const customUnits = readCustomUnits(options);
  const browserslist = readBrowserslist(options);

  const physical = logical === 'physical';
  const everyUnit = createUnitMap(customUnits, true, physical);
  probeLevels(everyUnit, probeUnits(everyUnit, customUnits));

  const variants = new Map<boolean, ResolvedConfig>();
  const variant = (withBuiltIns: boolean): ResolvedConfig => {
    let config = variants.get(withBuiltIns);
    if (!config) {
      const unitMap = createUnitMap(customUnits, withBuiltIns, physical);
      const probes = probeUnits(unitMap, customUnits);
      config = {
        active: unitMap.size > 0,
        strategy,
        preserve,
        includeCustomProps,
        anyFallback: existing === 'any',
        fragmentGuards,
        seed,
        strict,
        fastSkip,
        verbose: debug.verbose,
        summary: debug.summary,
        unitMap,
        terminals: terminalUnits(unitMap),
        probes,
        levels: probeLevels(unitMap, probes),
        dimension: createDimensionRegex(unitMap.keys()),
        quickTest: createQuickTest(unitMap.keys()),
        allows: createPropertyGate(only, exclude),
        onTransform,
        onComplete,
      };
      variants.set(withBuiltIns, config);
    }
    return config;
  };

  if (browserslist !== true) {
    const supported = browserslist !== false && targetsSupportViewportUnits(browserslist);
    const config = variant(!supported);
    return { forFile: () => config };
  }

  const byDirectory = new Map<string, ResolvedConfig>();
  const forDirectory = (directory: string): ResolvedConfig => {
    let config = byDirectory.get(directory);
    if (!config) {
      config = variant(!targetsSupportViewportUnits(true, undefined, directory));
      byDirectory.set(directory, config);
    }
    return config;
  };
  forDirectory(process.cwd());
  return {
    forFile: (file) => forDirectory(file ? dirname(resolve(file)) : process.cwd()),
  };
}

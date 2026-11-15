import type { ViewportFallbackOptions } from '../src';

export interface Settings {
  strategy: 'duplicate' | 'css-var';
  preserve: boolean;
  includeCustomProps: boolean;
  fragmentGuards: boolean;
  seed: boolean;
  existingFallback: 'exact' | 'any';
  logicalFallback: 'physical' | 'logical';
  customUnits: string;
}

export interface State {
  css: string;
  settings: Settings;
}

export const DEFAULTS: Settings = {
  strategy: 'duplicate',
  preserve: true,
  includeCustomProps: false,
  fragmentGuards: false,
  seed: true,
  existingFallback: 'exact',
  logicalFallback: 'physical',
  customUnits: '',
};

const CHOICES: Partial<Record<keyof Settings, readonly string[]>> = {
  strategy: ['duplicate', 'css-var'],
  existingFallback: ['exact', 'any'],
  logicalFallback: ['physical', 'logical'],
};

const NAMES = Object.keys(DEFAULTS) as (keyof Settings)[];

/** `cqh: svh, cqw: svw` as the map the plugin takes; what cannot be read is left for the plugin to report. */
export function parseUnits(text: string): Record<string, string> | undefined {
  const pairs = text
    .split(/[,;\n]/)
    .map((pair) => pair.trim())
    .filter(Boolean);
  if (pairs.length === 0) return undefined;
  return Object.fromEntries(
    pairs.map((pair) => {
      const [unit, fallback = ''] = pair.split(':');
      return [unit.trim(), fallback.trim()];
    })
  );
}

/** The settings that differ from the defaults, as options of the plugin. */
export function pluginOptions(settings: Settings): ViewportFallbackOptions {
  const options: Record<string, unknown> = {};
  for (const name of NAMES) {
    if (name !== 'customUnits' && settings[name] !== DEFAULTS[name]) {
      options[name] = settings[name];
    }
  }
  const customUnits = parseUnits(settings.customUnits);
  if (customUnits) options.customUnits = customUnits;
  return options;
}

const quote = (text: string): string => `'${text.replace(/[\\']/g, '\\$&')}'`;

function literal(value: unknown): string {
  if (typeof value === 'string') return quote(value);
  if (typeof value !== 'object') return String(value);
  const entries = Object.entries(value as Record<string, string>).map(
    ([key, text]) => `${/^[a-z_$][\w$]*$/i.test(key) ? key : quote(key)}: ${quote(text)}`
  );
  return `{ ${entries.join(', ')} }`;
}

/** A `postcss.config.js` that sets the plugin up the way the playground has it. */
export function configSnippet(settings: Settings): string {
  const lines = Object.entries(pluginOptions(settings)).map(
    ([name, value]) => `      ${name}: ${literal(value)},`
  );
  const plugins =
    lines.length === 0
      ? `  plugins: [viewportFallback()],`
      : `  plugins: [\n    viewportFallback({\n${lines.join('\n')}\n    }),\n  ],`;
  return `import viewportFallback from 'postcss-viewport-fallback';\n\nexport default {\n${plugins}\n};\n`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** The stylesheet and the settings that are not defaults, as a URL fragment without `#`. */
export function encodeState({ css, settings }: State): string {
  const changed = Object.fromEntries(
    NAMES.filter((name) => settings[name] !== DEFAULTS[name]).map((name) => [
      name,
      settings[name],
    ])
  );
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ c: css, s: changed })));
}

/** The state a URL fragment holds, or nothing when it is not one written by `encodeState`. */
export function decodeState(hash: string): State | undefined {
  let data: { c?: unknown; s?: Record<string, unknown> } | null;
  try {
    const bytes = fromBase64Url(hash.replace(/^#/, ''));
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
  if (typeof data?.c !== 'string') return undefined;

  const settings: Record<string, unknown> = { ...DEFAULTS };
  for (const name of NAMES) {
    const value = data.s?.[name];
    const known = CHOICES[name]?.includes(value as string) ?? true;
    if (typeof value === typeof DEFAULTS[name] && known) settings[name] = value;
  }
  return { css: data.c, settings: settings as unknown as Settings };
}

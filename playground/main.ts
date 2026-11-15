import { setPluginLanguage } from './shims/process';
import postcss from 'postcss';
import viewportFallback from '../src';
import type { TransformStats } from '../src';
import { writtenLines } from './diff';
import { EXAMPLES } from './examples';
import { STRINGS, preferredLanguage } from './i18n';
import type { Language, StringKey } from './i18n';
import {
  DEFAULTS,
  configSnippet,
  decodeState,
  encodeState,
  pluginOptions,
} from './state';
import type { Settings } from './state';

interface Note {
  line?: number;
  column?: number;
  text: string;
}

const STORAGE_KEY = 'pvf-playground-language';
const TYPING_PAUSE = 120;
const FLASH = 1200;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const source = byId<HTMLTextAreaElement>('source');
const result = byId<HTMLPreElement>('result');
const form = byId<HTMLFormElement>('settings');
const config = byId<HTMLPreElement>('config');
const examples = byId<HTMLSelectElement>('example');
const notes = byId<HTMLElement>('notes');
const noteList = byId<HTMLUListElement>('note-list');
const failure = byId<HTMLElement>('failure');
const failureText = byId<HTMLElement>('failure-text');
const readout = {
  declarations: byId('stat-declarations'),
  atRules: byId('stat-at-rules'),
  skipped: byId('stat-skipped'),
  time: byId('stat-time'),
};

let language: Language = preferredLanguage(stored(), navigator.language);
let settings: Settings = { ...DEFAULTS };
let latest = 0;
let output = '';

function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(value: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    return;
  }
}

const say = (key: StringKey): string => STRINGS[language][key];

function translate(): void {
  document.documentElement.lang = language;
  setPluginLanguage(language);
  for (const node of document.querySelectorAll<HTMLElement>('[data-t]')) {
    node.textContent = say(node.dataset.t as StringKey);
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-t-label]')) {
    node.setAttribute('aria-label', say(node.dataset.tLabel as StringKey));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  }
  for (const option of examples.options) {
    const example = EXAMPLES.find(({ id }) => id === option.value);
    if (example) option.textContent = say(example.title);
  }
}

function readSettings(): Settings {
  const data = new FormData(form);
  const checked = (name: string): boolean => data.get(name) === 'on';
  return {
    strategy: data.get('strategy') as Settings['strategy'],
    preserve: checked('preserve'),
    includeCustomProps: checked('includeCustomProps'),
    fragmentGuards: checked('fragmentGuards'),
    seed: settings.strategy === 'css-var' ? checked('seed') : settings.seed,
    existingFallback: data.get('existingFallback') as Settings['existingFallback'],
    logicalFallback: data.get('logicalFallback') as Settings['logicalFallback'],
    customUnits: String(data.get('customUnits') ?? ''),
  };
}

function writeSettings(): void {
  for (const control of form.elements) {
    if (!(control instanceof HTMLInputElement)) continue;
    const value = settings[control.name as keyof Settings];
    if (control.type === 'checkbox') control.checked = value === true;
    else if (control.type === 'radio') control.checked = control.value === value;
    else control.value = String(value);
  }
  syncSeed();
}

function syncSeed(): void {
  const seed = form.elements.namedItem('seed') as HTMLInputElement;
  seed.disabled = settings.strategy !== 'css-var';
  seed.closest('.field')!.toggleAttribute('data-off', seed.disabled);
}

function show(css: string, notesFound: Note[], stats: TransformStats): void {
  output = css;
  let written = new Set<number>();
  try {
    written = writtenLines(postcss.parse(source.value), postcss.parse(css));
  } catch {
    written = new Set();
  }

  const lines = document.createDocumentFragment();
  css
    .replace(/\n$/, '')
    .split('\n')
    .forEach((text, index) => {
      const line = document.createElement('span');
      line.className = 'line';
      line.textContent = text || ' ';
      if (written.has(index + 1)) line.dataset.written = '';
      lines.append(line);
    });
  result.replaceChildren(lines);
  result.hidden = false;
  failure.hidden = true;

  readout.declarations.textContent = String(stats.declarations);
  readout.atRules.textContent = String(stats.atRules);
  readout.skipped.textContent = String(stats.skipped);
  readout.time.textContent = `${stats.timeMs.toFixed(2)} ${say('ms')}`;

  noteList.replaceChildren(
    ...notesFound.map(({ line, column, text }) => {
      const item = document.createElement('li');
      if (line !== undefined) {
        const place = document.createElement('code');
        place.textContent = `${line}:${column}`;
        item.append(place, ' ');
      }
      item.append(text);
      return item;
    })
  );
  notes.hidden = notesFound.length === 0;
}

function showFailure(error: unknown): void {
  const problem = error as { reason?: string; line?: number; column?: number };
  output = '';
  failureText.textContent =
    problem.reason && problem.line !== undefined
      ? `${problem.line}:${problem.column} ${problem.reason}`
      : String((error as Error).message ?? error);
  failure.hidden = false;
  result.hidden = true;
  notes.hidden = true;
  for (const cell of Object.values(readout)) cell.textContent = '–';
}

async function process(): Promise<void> {
  const run = ++latest;
  let stats: TransformStats = { declarations: 0, atRules: 0, skipped: 0, timeMs: 0 };
  try {
    const plugin = viewportFallback({
      ...pluginOptions(settings),
      onComplete: (final) => void (stats = final),
    });
    const processed = await postcss([plugin]).process(source.value, { from: undefined });
    if (run !== latest) return;
    show(
      processed.css,
      processed.warnings().map(({ line, column, text }) => ({ line, column, text })),
      stats
    );
  } catch (error) {
    if (run === latest) showFailure(error);
  }
}

function remember(): void {
  config.textContent = configSnippet(settings);
  history.replaceState(null, '', `#${encodeState({ css: source.value, settings })}`);
}

function refresh(): void {
  remember();
  void process();
}

function load(css: string, next: Settings, example = ''): void {
  source.value = css;
  settings = next;
  examples.value = example;
  writeSettings();
  refresh();
}

function restore(): boolean {
  const state = decodeState(location.hash);
  if (state) load(state.css, state.settings);
  return state !== undefined;
}

async function copy(button: HTMLButtonElement, text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.className = 'offscreen';
    document.body.append(scratch);
    scratch.select();
    document.execCommand('copy');
    scratch.remove();
  }
  button.textContent = say('copied');
  button.dataset.done = '';
  setTimeout(() => {
    button.textContent = say(button.dataset.t as StringKey);
    delete button.dataset.done;
  }, FLASH);
}

for (const { id } of EXAMPLES) examples.add(new Option('', id));

let typing = 0;
source.addEventListener('input', () => {
  examples.value = '';
  clearTimeout(typing);
  typing = window.setTimeout(refresh, TYPING_PAUSE);
});

form.addEventListener('input', () => {
  settings = readSettings();
  examples.value = '';
  syncSeed();
  refresh();
});
form.addEventListener('submit', (event) => event.preventDefault());

examples.addEventListener('change', () => {
  const example = EXAMPLES.find(({ id }) => id === examples.value);
  if (example) load(example.css, { ...DEFAULTS, ...example.settings }, example.id);
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-language]')) {
  button.addEventListener('click', () => {
    language = button.dataset.language as Language;
    store(language);
    translate();
    void process();
  });
}

byId<HTMLButtonElement>('copy-output').addEventListener('click', (event) => {
  void copy(event.currentTarget as HTMLButtonElement, output);
});
byId<HTMLButtonElement>('copy-config').addEventListener('click', (event) => {
  void copy(event.currentTarget as HTMLButtonElement, configSnippet(settings));
});
byId<HTMLButtonElement>('copy-link').addEventListener('click', (event) => {
  void copy(event.currentTarget as HTMLButtonElement, location.href);
});

window.addEventListener('hashchange', restore);

translate();
if (!restore()) load(EXAMPLES[0].css, { ...DEFAULTS }, EXAMPLES[0].id);

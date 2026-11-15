import valueParser from 'postcss-value-parser';
import type { UnitTables } from './parser';
import { transformValue } from './parser';

export type QueryListOwner = 'media' | 'import' | 'custom-media';

export interface QueryListChange {
  /** The new list. */
  value: string;
  /** The list as its author wrote it, and the same list lowered by one step. */
  original: string;
  fallback: string;
}

const COMMENT = /\/\*[\s\S]*?\*\//g;
const DASHED_NAME_OR_CAPITALS = /--[^\s():,<>=/]+|[A-Z]+/g;
const MEANINGLESS_SPACE =
  /(?<=[(:,/)]) | (?=[):,/])|(?<![<>=]) (?=[<>=])|(?<=[<>=]) (?![<>=])/g;

/**
 * Spelling-independent form of a media query, for telling two of them apart. Comments, letter
 * case (custom media names aside) and spacing do not count, except for the spaces that change
 * the meaning: between a keyword and `(`, and inside a comparison such as `> =`.
 */
export function normalizeQuery(query: string): string {
  return query
    .replace(COMMENT, ' ')
    .replace(DASHED_NAME_OR_CAPITALS, (part) =>
      part.startsWith('--') ? part : part.toLowerCase()
    )
    .replace(/\s+/g, ' ')
    .replace(MEANINGLESS_SPACE, '')
    .trim();
}

/** The comma-separated parts of a media query list; strings and comments are opaque. */
export function splitQueries(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (char === '"' || char === "'") {
      const close = list.indexOf(char, i + 1);
      i = close === -1 ? list.length : close;
    } else if (char === '/' && list[i + 1] === '*') {
      const close = list.indexOf('*/', i + 2);
      i = close === -1 ? list.length : close + 1;
    } else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts;
}

/** Where the media query list of a prelude starts; -1 when the prelude has none. */
export function queryListStart(owner: QueryListOwner, params: string): number {
  if (owner === 'media') return 0;

  const nodes = valueParser(params).nodes;
  let index = 1;
  const skipSpace = (): void => {
    while (nodes[index]?.type === 'space' || nodes[index]?.type === 'comment') index++;
  };
  const isNamed = (name: string, ...types: string[]): boolean =>
    types.includes(nodes[index]?.type) && nodes[index].value.toLowerCase() === name;

  skipSpace();
  if (owner === 'import') {
    if (isNamed('layer', 'word', 'function')) index++;
    skipSpace();
    if (isNamed('supports', 'function')) index++;
    skipSpace();
  }
  return nodes[index]?.sourceIndex ?? -1;
}

/** Every lowered form of a query, weakest first; empty when it uses no mapped unit. */
function ladderOf(query: string, tables: UnitTables): string[] {
  const steps: string[] = [];
  for (let step = transformValue(query, tables, 'duplicate'); step;) {
    steps.unshift(step.value);
    step = transformValue(step.value, tables, 'duplicate');
  }
  return steps;
}

/**
 * Give every query that uses mapped units its lowered forms as further queries of the list
 * (or, without `preserve`, put the lowest form in its place). Null when the list stays as it is.
 */
export function lowerQueryList(
  list: string,
  tables: UnitTables,
  preserve: boolean
): QueryListChange | null {
  const authored = splitQueries(list);
  const present = new Set(authored.map(normalizeQuery));
  const added = new Set<string>();
  const result: string[] = [];

  for (const query of authored) {
    const ladder = ladderOf(query, tables);
    if (preserve) {
      for (const lowered of ladder) {
        const key = normalizeQuery(lowered);
        if (present.has(key) || added.has(key)) continue;
        added.add(key);
        result.push(lowered);
      }
      result.push(query);
    } else {
      const lowest = ladder[0] ?? query;
      if (!result.some((kept) => normalizeQuery(kept) === normalizeQuery(lowest))) {
        result.push(lowest);
      }
    }
  }

  const unchanged =
    result.length === authored.length &&
    result.every((query, i) => normalizeQuery(query) === normalizeQuery(authored[i]));
  if (unchanged) return null;

  const spaced = list.includes(',') ? /,\s/.test(list) : /\s/.test(list);
  const separator = spaced ? ', ' : ',';
  const original = authored.join(separator);
  return {
    value: result.join(separator),
    original,
    fallback: authored
      .map((query) => ladderOf(query, tables).pop() ?? query)
      .join(separator),
  };
}

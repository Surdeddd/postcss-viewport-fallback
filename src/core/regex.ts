const NUMBER = String.raw`[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?`;
const NOT_AFTER_NAME = String.raw`(?<![\w.#\\\-\u0080-\uFFFF])`;
const NOT_BEFORE_NAME = String.raw`(?![\w\\\-\u0080-\uFFFF])`;
const NEVER = '(?!)';

function alternation(units: Iterable<string>): string {
  return [...units].join('|');
}

/** Global matcher for `<number><unit>` dimension tokens; groups: number text, unit. */
export function createDimensionRegex(units: Iterable<string>): RegExp {
  const names = alternation(units);
  return new RegExp(
    names ? `${NOT_AFTER_NAME}(${NUMBER})(${names})${NOT_BEFORE_NAME}` : NEVER,
    'gi'
  );
}

/** Cheap stateless substring pre-filter: a digit immediately followed by a known unit. */
export function createQuickTest(units: Iterable<string>): RegExp {
  const names = alternation(units);
  return new RegExp(names ? String.raw`\d(?:${names})` : NEVER, 'i');
}

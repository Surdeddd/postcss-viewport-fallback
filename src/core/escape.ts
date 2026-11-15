const ESCAPE = /\\(?:([0-9a-f]{1,6})\s?|([^\n]))/gi;

/** Text with CSS escapes resolved, for comparing names that may be written in several ways. */
export function decodeEscapes(text: string): string {
  if (!text.includes('\\')) return text;
  return text.replace(ESCAPE, (_escape, hex: string | undefined, char: string) => {
    if (hex === undefined) return char;
    const codePoint = parseInt(hex, 16);
    const isScalar =
      codePoint > 0 &&
      codePoint <= 0x10ffff &&
      (codePoint < 0xd800 || codePoint > 0xdfff);
    return isScalar ? String.fromCodePoint(codePoint) : '\uFFFD';
  });
}

export function isCustomProperty(prop: string): boolean {
  return decodeEscapes(prop).startsWith('--');
}

/** Custom property names are case-sensitive, every other property name is not. */
export function sameProperty(a: string, b: string): boolean {
  if (a === b) return true;
  const left = decodeEscapes(a);
  const right = decodeEscapes(b);
  return left.startsWith('--') || right.startsWith('--')
    ? left === right
    : left.toLowerCase() === right.toLowerCase();
}

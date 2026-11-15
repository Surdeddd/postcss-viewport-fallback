import { describe, it, expect } from 'vitest';
import { decodeEscapes, isCustomProperty, sameProperty } from '../../src/core/escape';

describe('decodeEscapes', () => {
  it('returns text without escapes as it is', () => {
    expect(decodeEscapes('min-height')).toBe('min-height');
  });

  it('resolves hex escapes and swallows one whitespace after them', () => {
    expect(decodeEscapes('\\2d -x')).toBe('--x');
    expect(decodeEscapes('\\00002dx')).toBe('-x');
    expect(decodeEscapes('h\\65 ight')).toBe('height');
  });

  it('resolves escaped characters that are not hex digits', () => {
    expect(decodeEscapes('\\-\\-x')).toBe('--x');
    expect(decodeEscapes('a\\:b')).toBe('a:b');
  });

  it.each(['\\0', '\\110000', '\\d800', '\\DFFF '])(
    'turns %s into the replacement character, as CSS does',
    (escape) => {
      expect(decodeEscapes(escape)).toBe('\uFFFD');
    }
  );
});

describe('isCustomProperty', () => {
  it.each(['--x', '\\2d -x', '\\-\\-x', '-\\-x'])('accepts %s', (prop) => {
    expect(isCustomProperty(prop)).toBe(true);
  });

  it.each(['height', '-webkit-box', '\\2d webkit-box'])('rejects %s', (prop) => {
    expect(isCustomProperty(prop)).toBe(false);
  });
});

describe('sameProperty', () => {
  it('ignores case for regular properties only', () => {
    expect(sameProperty('HEIGHT', 'height')).toBe(true);
    expect(sameProperty('--Gap', '--gap')).toBe(false);
    expect(sameProperty('--gap', '--gap')).toBe(true);
  });

  it('compares names after resolving escapes', () => {
    expect(sameProperty('--x', '--\\78')).toBe(true);
    expect(sameProperty('h\\65 ight', 'HEIGHT')).toBe(true);
    expect(sameProperty('--x', '--\\79')).toBe(false);
  });
});

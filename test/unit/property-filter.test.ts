import { describe, it, expect } from 'vitest';
import { createPropertyGate, createPropertyMatcher } from '../../src/core/propertyFilter';

describe('property matcher', () => {
  it('matches regular names case-insensitively and custom names exactly', () => {
    const matches = createPropertyMatcher(['Height', '--Sheet']);
    expect(matches('height')).toBe(true);
    expect(matches('HEIGHT')).toBe(true);
    expect(matches('--Sheet')).toBe(true);
    expect(matches('--sheet')).toBe(false);
    expect(matches('width')).toBe(false);
  });

  it('does not let a regular name match a custom property or the reverse', () => {
    const matches = createPropertyMatcher(['height', '--height']);
    expect(matches('--height')).toBe(true);
    expect(createPropertyMatcher(['height'])('--height')).toBe(false);
    expect(createPropertyMatcher(['--height'])('height')).toBe(false);
  });

  it('tests RegExps against the name as written and never keeps lastIndex state', () => {
    const global = /^padding/g;
    const matches = createPropertyMatcher([global]);
    expect(matches('padding-top')).toBe(true);
    expect(matches('padding-left')).toBe(true);
    expect(matches('PADDING-TOP')).toBe(false);
    expect(global.lastIndex).toBe(0);
  });

  it('matches at-rule labels', () => {
    expect(createPropertyMatcher(['@MEDIA'])('@media')).toBe(true);
    expect(createPropertyMatcher([/^@/])('@container')).toBe(true);
  });

  it('matches nothing for an empty list', () => {
    expect(createPropertyMatcher([])('height')).toBe(false);
  });
});

describe('property gate', () => {
  it('allows everything without filters', () => {
    expect(createPropertyGate(undefined, undefined)('anything')).toBe(true);
  });

  it('applies the denylist over the allowlist', () => {
    const allows = createPropertyGate(['height', 'width'], ['width']);
    expect(allows('height')).toBe(true);
    expect(allows('width')).toBe(false);
    expect(allows('margin')).toBe(false);
  });

  it('supports only a denylist or only an allowlist', () => {
    expect(createPropertyGate(undefined, ['width'])('height')).toBe(true);
    expect(createPropertyGate(undefined, ['width'])('width')).toBe(false);
    expect(createPropertyGate(['width'], undefined)('height')).toBe(false);
  });
});

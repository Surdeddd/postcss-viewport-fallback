import { describe, it, expect } from 'vitest';
import plugin from '../src';
import type { ViewportFallbackOptions } from '../src';
import { run } from './helpers/run';

describe('logical viewport units fall back to physical ones', () => {
  it('maps the inline axis to vw and the block axis to vh by default', async () => {
    expect(await run(`.a { width: 100dvi; height: 100svb; inline-size: 50lvi; }`)).toBe(
      `.a { width: 100vw; width: 100dvi; height: 100vh; height: 100svb; inline-size: 50vw; inline-size: 50lvi; }`
    );
  });

  it('keeps vi and vb with logicalFallback: "logical"', async () => {
    expect(
      await run(`.a { width: 100dvi; height: 100svb; }`, { logicalFallback: 'logical' })
    ).toBe(`.a { width: 100vi; width: 100dvi; height: 100vb; height: 100svb; }`);
  });

  it('uses the physical unit as the css-var default', async () => {
    expect(await run(`.a{width:1dvi}`, { strategy: 'css-var', preserve: false })).toBe(
      `:root, :host { --pvf-dvi: 1vw }\n@supports (height: 1dvh) { :root, :host { --pvf-dvi: 1dvi } }\n.a{width:calc(var(--pvf-dvi, 1vw) * 1)}`
    );
  });

  it('lets customUnits decide for a single unit', async () => {
    expect(await run(`.a { width: 100dvi; }`, { customUnits: { dvi: 'vi' } })).toBe(
      `.a { width: 100vi; width: 100dvi; }`
    );
  });

  it('rejects anything else', () => {
    expect(() =>
      plugin({ logicalFallback: 'vw' } as unknown as ViewportFallbackOptions)
    ).toThrow(
      /invalid option "logicalFallback": expected "physical" or "logical", received "vw"/
    );
  });
});

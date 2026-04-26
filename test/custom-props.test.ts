import postcss from 'postcss';
import { describe, it, expect } from 'vitest';
import viewportFallback from '../src/plugin/index';

function run(css: string, opts: any = {}) {
  return postcss([viewportFallback(opts)]).process(css, { from: undefined });
}

describe('viewport-fallback / custom props behavior', () => {
  const css = `
    :root {
      --header-h: 100dvh;
    }
    .box {
      height: var(--header-h, 100dvh);
    }
  `;

  it('skips custom props by default', async () => {
    const result = await run(css);

    // custom prop untouched
    expect(result.css).toContain('--header-h: 100dvh;');

    // fallback inside var() IS allowed → 100vh appears
    expect(result.css).toContain('var(--header-h, 100vh)');
  });

  it('transforms custom props when includeCustomProps = true', async () => {
    const result = await run(css, { includeCustomProps: true });

    expect(result.css).toContain('--header-h: 100vh;');
    expect(result.css).toContain('--header-h: 100dvh;');

    expect(result.css).toContain('var(--header-h, 100vh)');
    expect(result.css).toContain('var(--header-h, 100dvh)');
  });
});

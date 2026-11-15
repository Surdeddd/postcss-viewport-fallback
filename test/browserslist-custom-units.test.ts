import { describe, it, expect } from 'vitest';
import { run } from './helpers/run';

const modern = { browserslist: 'chrome >= 130' };

describe('browserslist auto-skip with customUnits', () => {
  it('keeps transforming customUnits when every target supports the built-in units', async () => {
    const out = await run(`.a { height: 100dvh; width: 100cqw; }`, {
      ...modern,
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(`.a { height: 100dvh; width: 100vw; width: 100cqw; }`);
  });

  it('stops a custom chain at a built-in unit the targets support', async () => {
    const out = await run(`.a { height: 100cqh; }`, {
      ...modern,
      customUnits: { cqh: 'svh' },
    });
    expect(out).toBe(`.a { height: 100svh; height: 100cqh; }`);
  });

  it('leaves built-in units in at-rule params alone but still handles custom ones', async () => {
    const out = await run(
      `@media (min-height: 50dvh) { .a { color: red; } }
@media (min-height: 50cqh) { .b { color: red; } }`,
      { ...modern, customUnits: { cqh: 'vh' } }
    );
    expect(out).toBe(`@media (min-height: 50dvh) { .a { color: red; } }
@media (min-height: 50vh), (min-height: 50cqh) { .b { color: red; } }`);
  });

  it('still transforms everything when a target lacks support', async () => {
    const out = await run(`.a { height: 100dvh; width: 100cqw; }`, {
      browserslist: 'ie 11',
      customUnits: { cqw: 'vw' },
    });
    expect(out).toBe(
      `.a { height: 100vh; height: 100dvh; width: 100vw; width: 100cqw; }`
    );
  });
});

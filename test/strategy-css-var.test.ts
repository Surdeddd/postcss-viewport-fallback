import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import plugin from '../src';

async function run(input: string, opts = {}) {
  const result = await postcss([plugin({ strategy: 'css-var', ...opts })]).process(input, {
    from: undefined,
  });
  return result.css;
}

describe('strategy: css-var', () => {
  it('rewrites bare values to calc(var(...))', async () => {
    const out = await run(`.a { height: 100dvh; }`);
    expect(out).toContain('height: calc(var(--pvf-dvh, 1vh) * 100)');
    expect(out).toContain('height: 100dvh');
  });

  it('works inside calc with pixel math', async () => {
    const out = await run(`.a { height: calc(100dvh - 64px); }`);
    expect(out).toContain('height: calc(calc(var(--pvf-dvh, 1vh) * 100) - 64px)');
  });

  it('handles negative and decimal numbers', async () => {
    const out = await run(`.a { margin-top: -12.5dvh; }`);
    expect(out).toContain('calc(var(--pvf-dvh, 1vh) * -12.5)');
  });

  it('injects a :root seed with only the used units', async () => {
    const out = await run(`.a { height: 100dvh; width: 50svw; }`);
    expect(out).toContain(':root { --pvf-dvh: 1vh; --pvf-svw: 1vw }');
    expect(out).toContain('@supports (height: 1dvh) { :root { --pvf-dvh: 1dvh } }');
    expect(out).toContain('@supports (height: 1svw) { :root { --pvf-svw: 1svw } }');
    expect(out).not.toContain('--pvf-lvh');
  });

  it('injects no seed when nothing was transformed', async () => {
    const out = await run(`.a { height: 100vh; }`);
    expect(out).not.toContain('--pvf-');
  });

  it('keeps duplicate strategy for at-rule params', async () => {
    const out = await run(`@media (min-height: 100dvh) { .a { color: red; } }`);
    expect(out).toContain('@media (min-height: 100vh)');
    expect(out).not.toContain('@media (min-height: calc');
  });

  it('preserve: false keeps only the calc version', async () => {
    const out = await run(`.a { height: 100dvh; }`, { preserve: false });
    expect(out).toContain('calc(var(--pvf-dvh, 1vh) * 100)');
    expect(out).not.toContain('100dvh');
  });

  it('is idempotent across runs', async () => {
    const first = await postcss([plugin({ strategy: 'css-var' })]).process(
      `.a { height: 100dvh; }`,
      { from: undefined },
    );
    const second = await postcss([plugin({ strategy: 'css-var' })]).process(first.css, {
      from: undefined,
    });
    expect(second.css).toBe(first.css);
  });

  it('is idempotent even with includeCustomProps: true', async () => {
    const opts = { strategy: 'css-var' as const, includeCustomProps: true };
    const first = await postcss([plugin(opts)]).process(`.a { height: 100dvh; }`, {
      from: undefined,
    });
    const second = await postcss([plugin(opts)]).process(first.css, { from: undefined });
    expect(second.css).toBe(first.css);
  });

  it('transforms custom properties when enabled', async () => {
    const out = await run(`.a { --sheet-height: 80dvh; }`, { includeCustomProps: true });
    expect(out).toContain('--sheet-height: calc(var(--pvf-dvh, 1vh) * 80)');
  });

  it('respects property filters', async () => {
    const out = await run(`.a { height: 100dvh; width: 100dvw; }`, {
      onlyProperties: 'height',
    });
    expect(out).toContain('height: calc(var(--pvf-dvh, 1vh) * 100)');
    expect(out).not.toContain('width: calc');
    expect(out).not.toContain('--pvf-dvw');
  });

  it('works with customUnits', async () => {
    const out = await run(`.a { height: 100cqh; }`, { customUnits: { cqh: 'vh' } });
    expect(out).toContain('calc(var(--pvf-cqh, 1vh) * 100)');
    expect(out).toContain('@supports (height: 1cqh) { :root { --pvf-cqh: 1cqh } }');
  });

  it('reports stats for css-var transforms', async () => {
    let stats;
    await run(`.a { height: 100dvh; }`, { onComplete: (s: unknown) => (stats = s) });
    expect(stats).toMatchObject({ declarations: 1 });
  });
});

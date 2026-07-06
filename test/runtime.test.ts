import { describe, it, expect, vi } from 'vitest';
import { applyViewportVars } from '../src/runtime';

function fakeWindow(overrides: Record<string, unknown> = {}) {
  const props = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    innerWidth: 400,
    innerHeight: 700,
    visualViewport: undefined,
    CSS: { supports: () => false },
    getComputedStyle: () => ({ writingMode: 'horizontal-tb' }),
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
    document: {
      documentElement: {
        style: {
          setProperty: (name: string, value: string) => props.set(name, value),
        },
      },
    },
    ...overrides,
  };
  return {
    win: win as unknown as Window & typeof globalThis,
    props,
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    listeners,
  };
}

describe('runtime applyViewportVars', () => {
  it('is a no-op when the browser supports dvh', () => {
    const { win, props } = fakeWindow({ CSS: { supports: () => true } });
    const handle = applyViewportVars(win);
    handle.update();
    handle.destroy();
    expect(props.size).toBe(0);
  });

  it('sets 1% pixel values for all unit families', () => {
    const { win, props } = fakeWindow();
    applyViewportVars(win);
    expect(props.get('--pvf-dvh')).toBe('7px');
    expect(props.get('--pvf-dvw')).toBe('4px');
    expect(props.get('--pvf-dvi')).toBe('4px');
    expect(props.get('--pvf-dvb')).toBe('7px');
    expect(props.get('--pvf-dvmin')).toBe('4px');
    expect(props.get('--pvf-dvmax')).toBe('7px');
    expect(props.get('--pvf-svh')).toBe('7px');
    expect(props.get('--pvf-lvh')).toBe('7px');
  });

  it('tracks small/large extremes across resizes', () => {
    const { win, props, fire } = fakeWindow();
    applyViewportVars(win);
    (win as { innerHeight: number }).innerHeight = 600;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('6px');
    expect(props.get('--pvf-svh')).toBe('6px');
    expect(props.get('--pvf-lvh')).toBe('7px');
    (win as { innerHeight: number }).innerHeight = 800;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('8px');
    expect(props.get('--pvf-svh')).toBe('6px');
    expect(props.get('--pvf-lvh')).toBe('8px');
  });

  it('swaps inline/block for vertical writing modes', () => {
    const { win, props } = fakeWindow({
      getComputedStyle: () => ({ writingMode: 'vertical-rl' }),
    });
    applyViewportVars(win);
    expect(props.get('--pvf-dvi')).toBe('7px');
    expect(props.get('--pvf-dvb')).toBe('4px');
  });

  it('destroy removes listeners', () => {
    const { win, fire, props } = fakeWindow();
    const handle = applyViewportVars(win);
    handle.destroy();
    (win as { innerHeight: number }).innerHeight = 900;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('prefers visualViewport dimensions when available', () => {
    const vvListeners = new Set<() => void>();
    const { win, props } = fakeWindow({
      visualViewport: {
        width: 380,
        height: 660,
        addEventListener: (_: string, fn: () => void) => vvListeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => vvListeners.delete(fn),
      },
    });
    applyViewportVars(win);
    expect(props.get('--pvf-dvh')).toBe('6.6px');
    expect(props.get('--pvf-dvw')).toBe('3.8px');
  });

  it('does not throw without a window (SSR guard)', () => {
    expect(() => applyViewportVars(undefined as unknown as Window & typeof globalThis)).not.toThrow();
    vi.restoreAllMocks();
  });
});

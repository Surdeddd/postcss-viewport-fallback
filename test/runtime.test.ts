import { describe, it, expect, vi } from 'vitest';
import { applyViewportVars } from '../src/runtime';

interface FakeVV {
  width: number;
  height: number;
  scale: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

function fakeWindow(overrides: Record<string, unknown> = {}) {
  const props = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const vvListeners = new Set<() => void>();
  const state = {
    innerWidth: 400,
    innerHeight: 700,
    activeElement: null as { tagName: string; isContentEditable?: boolean } | null,
  };
  const win = {
    get innerWidth() {
      return state.innerWidth;
    },
    get innerHeight() {
      return state.innerHeight;
    },
    visualViewport: undefined as FakeVV | undefined,
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
      get activeElement() {
        return state.activeElement;
      },
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
    state,
    vvListeners,
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
    fireVV: () => vvListeners.forEach((fn) => fn()),
    attachVV(vv: Partial<FakeVV>) {
      (win as { visualViewport?: FakeVV }).visualViewport = {
        width: state.innerWidth,
        height: state.innerHeight,
        scale: 1,
        addEventListener: (_: string, fn: () => void) => vvListeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => vvListeners.delete(fn),
        ...vv,
      };
    },
    listenerCount: () =>
      [...listeners.values()].reduce((n, s) => n + s.size, 0) + vvListeners.size,
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

  it('sets 1% pixel values for all unit families from the layout viewport', () => {
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

  it('tracks small/large extremes across window resizes (URL bar collapse)', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.innerHeight = 600;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('6px');
    expect(props.get('--pvf-svh')).toBe('6px');
    expect(props.get('--pvf-lvh')).toBe('7px');
    state.innerHeight = 800;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('8px');
    expect(props.get('--pvf-svh')).toBe('6px');
    expect(props.get('--pvf-lvh')).toBe('8px');
  });

  it('resets extremes on orientation change instead of accumulating stale values', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.innerHeight = 650;
    fire('resize');
    expect(props.get('--pvf-svh')).toBe('6.5px');

    state.innerWidth = 700;
    state.innerHeight = 400;
    fire('orientationchange');
    expect(props.get('--pvf-dvh')).toBe('4px');
    expect(props.get('--pvf-svh')).toBe('4px');
    expect(props.get('--pvf-lvh')).toBe('4px');
    expect(props.get('--pvf-svw')).toBe('7px');

    state.innerHeight = 440;
    fire('resize');
    expect(props.get('--pvf-lvh')).toBe('4.4px');
    expect(props.get('--pvf-svh')).toBe('4px');
  });

  it('freezes all updates while pinch-zoomed', () => {
    const { win, props, state, fire, fireVV, attachVV } = fakeWindow();
    attachVV({});
    applyViewportVars(win);
    expect(props.get('--pvf-dvh')).toBe('7px');

    win.visualViewport!.scale = 2.5;
    (win.visualViewport as unknown as { height: number }).height = 280;
    state.innerHeight = 690;
    fireVV();
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
    expect(props.get('--pvf-svh')).toBe('7px');

    win.visualViewport!.scale = 1;
    fireVV();
    expect(props.get('--pvf-dvh')).toBe('6.9px');
  });

  it('ignores the on-screen keyboard (same width, >30% height collapse, editable focused)', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.activeElement = { tagName: 'INPUT' };
    state.innerHeight = 350;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
    expect(props.get('--pvf-svh')).toBe('7px');

    state.activeElement = null;
    state.innerHeight = 700;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('still follows large window resizes when no editable element is focused', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.innerHeight = 350;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('3.5px');
  });

  it('visualViewport resize alone does not change dv* while scale is 1 (keyboard on iOS)', () => {
    const { win, props, state, attachVV, fireVV } = fakeWindow();
    attachVV({});
    applyViewportVars(win);
    (win.visualViewport as unknown as { height: number }).height = 300;
    state.activeElement = { tagName: 'TEXTAREA' };
    fireVV();
    expect(props.get('--pvf-dvh')).toBe('7px');
    expect(props.get('--pvf-svh')).toBe('7px');
  });

  it('swaps inline/block for vertical writing modes', () => {
    const { win, props } = fakeWindow({
      getComputedStyle: () => ({ writingMode: 'vertical-rl' }),
    });
    applyViewportVars(win);
    expect(props.get('--pvf-dvi')).toBe('7px');
    expect(props.get('--pvf-dvb')).toBe('4px');
  });

  it('destroy removes every listener including visualViewport', () => {
    const { win, props, state, fire, attachVV, listenerCount } = fakeWindow();
    attachVV({});
    const handle = applyViewportVars(win);
    expect(listenerCount()).toBeGreaterThan(0);
    handle.destroy();
    expect(listenerCount()).toBe(0);
    state.innerHeight = 900;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('does not throw without a window (SSR guard)', () => {
    expect(() =>
      applyViewportVars(undefined as unknown as Window & typeof globalThis)
    ).not.toThrow();
  });

  it('survives getComputedStyle returning null (hidden iframe in old Firefox)', () => {
    const { win, props } = fakeWindow({ getComputedStyle: () => null });
    expect(() => applyViewportVars(win)).not.toThrow();
    expect(props.get('--pvf-dvi')).toBe('4px');
    expect(props.get('--pvf-dvb')).toBe('7px');
  });

  it('works without CSS.supports and visualViewport (very old engines)', () => {
    const { win, props, state, fire } = fakeWindow({ CSS: undefined });
    const handle = applyViewportVars(win);
    expect(props.get('--pvf-dvh')).toBe('7px');
    state.innerHeight = 500;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('5px');
    expect(() => handle.destroy()).not.toThrow();
  });

  it('treats contenteditable hosts as keyboard targets', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.activeElement = { tagName: 'DIV', isContentEditable: true };
    state.innerHeight = 300;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('does not write anything while the window has no size yet', () => {
    const { win, props, state, fire } = fakeWindow();
    state.innerWidth = 0;
    state.innerHeight = 0;
    applyViewportVars(win);
    expect(props.size).toBe(0);
    state.innerWidth = 400;
    state.innerHeight = 700;
    fire('resize');
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('uses the global window when called without arguments', () => {
    const { win, props } = fakeWindow();
    vi.stubGlobal('window', win);
    try {
      applyViewportVars();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(props.get('--pvf-dvh')).toBe('7px');
  });

  it('update() recomputes on demand', () => {
    const { win, props, state } = fakeWindow();
    const handle = applyViewportVars(win);
    state.innerHeight = 640;
    handle.update();
    expect(props.get('--pvf-dvh')).toBe('6.4px');
  });
});

describe('runtime scheduling', () => {
  function withFrames() {
    const frames: Array<() => void> = [];
    const cancelled: number[] = [];
    const fake = fakeWindow({
      requestAnimationFrame: (fn: () => void) => frames.push(fn),
      cancelAnimationFrame: (id: number) => cancelled.push(id),
    });
    return { ...fake, frames, cancelled };
  }

  it('coalesces a burst of events into one update per frame', () => {
    const { win, props, state, fire, frames } = withFrames();
    applyViewportVars(win);
    state.innerHeight = 600;
    fire('resize');
    fire('resize');
    fire('orientationchange');
    expect(frames).toHaveLength(1);
    expect(props.get('--pvf-dvh')).toBe('7px');

    frames[0]();
    expect(props.get('--pvf-dvh')).toBe('6px');

    state.innerHeight = 500;
    fire('resize');
    expect(frames).toHaveLength(2);
  });

  it('measures again when the page comes back from the back/forward cache', () => {
    const { win, props, state, fire } = fakeWindow();
    applyViewportVars(win);
    state.innerHeight = 650;
    fire('pageshow');
    expect(props.get('--pvf-dvh')).toBe('6.5px');
  });

  it('destroy cancels the frame it was waiting for and removes pageshow', () => {
    const { win, props, state, fire, frames, cancelled, listenerCount } = withFrames();
    const handle = applyViewportVars(win);
    state.innerHeight = 600;
    fire('resize');
    handle.destroy();
    expect(cancelled).toEqual([1]);
    expect(listenerCount()).toBe(0);

    handle.destroy();
    expect(cancelled).toEqual([1]);
    expect(frames).toHaveLength(1);
    expect(props.get('--pvf-dvh')).toBe('7px');
  });
});

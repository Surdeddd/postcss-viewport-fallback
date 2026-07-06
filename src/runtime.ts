const PREFIX = '--pvf-';

export interface ViewportVarsHandle {
  /** Recompute and set all variables immediately. */
  update(): void;
  /** Remove listeners. Set variables stay until overwritten. */
  destroy(): void;
}

/**
 * Legacy-browser companion for `strategy: 'css-var'`. In browsers that support
 * dynamic viewport units this is a no-op (the injected `@supports` seed already
 * upgraded the variables). In older browsers it sets pixel-perfect values from
 * the actual viewport and keeps them updated on resize.
 */
export function applyViewportVars(target?: Window & typeof globalThis): ViewportVarsHandle {
  const noop: ViewportVarsHandle = { update() {}, destroy() {} };
  const win = target ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win?.document?.documentElement) return noop;
  if (typeof win.CSS?.supports === 'function' && win.CSS.supports('height', '1dvh')) {
    return noop;
  }

  const style = win.document.documentElement.style;
  let minW = Infinity;
  let minH = Infinity;
  let maxW = 0;
  let maxH = 0;

  const set = (unit: string, px: number) => {
    style.setProperty(PREFIX + unit, px / 100 + 'px');
  };

  const update = () => {
    const vv = win.visualViewport;
    const w = vv?.width ?? win.innerWidth;
    const h = vv?.height ?? win.innerHeight;
    if (!w || !h) return;

    minW = Math.min(minW, w);
    minH = Math.min(minH, h);
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);

    const vertical = /^vertical|^sideways/.test(
      win.getComputedStyle(win.document.documentElement).writingMode || '',
    );
    const inline = (width: number, height: number) => (vertical ? height : width);
    const block = (width: number, height: number) => (vertical ? width : height);

    set('dvw', w);
    set('dvh', h);
    set('dvi', inline(w, h));
    set('dvb', block(w, h));
    set('dvmin', Math.min(w, h));
    set('dvmax', Math.max(w, h));

    set('svw', minW);
    set('svh', minH);
    set('svi', inline(minW, minH));
    set('svb', block(minW, minH));
    set('svmin', Math.min(minW, minH));
    set('svmax', Math.max(minW, minH));

    set('lvw', maxW);
    set('lvh', maxH);
    set('lvi', inline(maxW, maxH));
    set('lvb', block(maxW, maxH));
    set('lvmin', Math.min(maxW, maxH));
    set('lvmax', Math.max(maxW, maxH));
  };

  update();
  win.addEventListener('resize', update);
  win.addEventListener('orientationchange', update);
  win.visualViewport?.addEventListener('resize', update);

  return {
    update,
    destroy() {
      win.removeEventListener('resize', update);
      win.removeEventListener('orientationchange', update);
      win.visualViewport?.removeEventListener('resize', update);
    },
  };
}

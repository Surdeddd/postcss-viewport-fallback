const PREFIX = '--pvf-';
const KEYBOARD_SHRINK_RATIO = 0.7;

export interface ViewportVarsHandle {
  /** Recompute and set all variables immediately. */
  update(): void;
  /** Remove listeners. Set variables stay until overwritten. */
  destroy(): void;
}

/**
 * Legacy-browser companion for `strategy: 'css-var'`. In browsers that support
 * dynamic viewport units this is a no-op (the injected `@supports` seed already
 * upgraded the variables). In older browsers it approximates the viewport units
 * from the live window size:
 * - dv* follow the current layout viewport (`innerWidth`/`innerHeight`)
 * - sv*\/lv* track the smallest/largest size seen in the current orientation
 * - updates are frozen while pinch-zoomed (`visualViewport.scale !== 1`)
 * - a same-width height collapse beyond 30% while an editable element is
 *   focused is treated as the on-screen keyboard and ignored, matching
 *   native `dv*` semantics
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
  let landscape: boolean | undefined;
  let lastW = 0;
  let lastH = 0;

  const set = (unit: string, px: number) => {
    style.setProperty(PREFIX + unit, px / 100 + 'px');
  };

  const apply = (w: number, h: number) => {
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

  const update = () => {
    const scale = win.visualViewport?.scale;
    if (scale !== undefined && Math.abs(scale - 1) > 0.001) return;

    const w = win.innerWidth;
    const h = win.innerHeight;
    if (!w || !h) return;

    const active = win.document.activeElement as HTMLElement | null;
    const editableFocused =
      !!active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    const keyboardLikely =
      editableFocused && lastW !== 0 && w === lastW && h < lastH * KEYBOARD_SHRINK_RATIO;
    if (keyboardLikely) return;

    const nowLandscape = w > h;
    if (landscape !== undefined && nowLandscape !== landscape) {
      minW = Infinity;
      minH = Infinity;
      maxW = 0;
      maxH = 0;
    }
    landscape = nowLandscape;
    lastW = w;
    lastH = h;

    minW = Math.min(minW, w);
    minH = Math.min(minH, h);
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);

    apply(w, h);
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

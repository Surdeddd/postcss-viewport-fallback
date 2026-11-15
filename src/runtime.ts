var PREFIX = '--pvf-';
var KEYBOARD_SHRINK_RATIO = 0.7;
var VERTICAL_WRITING_MODE = /^vertical|^sideways/;

export interface ViewportVarsHandle {
  /** Recompute and set all variables immediately. */
  update(): void;
  /** Remove listeners. Set variables stay until overwritten. */
  destroy(): void;
}

function noop(): void {}

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
 * - a burst of resize events costs one update per frame, and a page restored
 *   from the back/forward cache is measured again
 */
export function applyViewportVars(
  target?: Window & typeof globalThis
): ViewportVarsHandle {
  var win = target || (typeof window !== 'undefined' ? window : undefined);
  var root = win && win.document && win.document.documentElement;
  if (!win || !root) return { update: noop, destroy: noop };
  if (
    win.CSS &&
    typeof win.CSS.supports === 'function' &&
    win.CSS.supports('height', '1dvh')
  ) {
    return { update: noop, destroy: noop };
  }

  var view = win;
  var element = root;
  var style = root.style;
  var viewport = win.visualViewport;
  var minW = Infinity;
  var minH = Infinity;
  var maxW = 0;
  var maxH = 0;
  var landscape: boolean | undefined;
  var lastW = 0;
  var lastH = 0;

  function set(unit: string, px: number): void {
    style.setProperty(PREFIX + unit, px / 100 + 'px');
  }

  function setVariant(variant: string, w: number, h: number, vertical: boolean): void {
    set(variant + 'vw', w);
    set(variant + 'vh', h);
    set(variant + 'vi', vertical ? h : w);
    set(variant + 'vb', vertical ? w : h);
    set(variant + 'vmin', Math.min(w, h));
    set(variant + 'vmax', Math.max(w, h));
  }

  function update(): void {
    if (viewport && Math.abs(viewport.scale - 1) > 0.001) return;

    var w = view.innerWidth;
    var h = view.innerHeight;
    if (!w || !h) return;

    var active = view.document.activeElement as HTMLElement | null;
    var editableFocused =
      !!active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable);
    var keyboardLikely =
      editableFocused && lastW !== 0 && w === lastW && h < lastH * KEYBOARD_SHRINK_RATIO;
    if (keyboardLikely) return;

    var nowLandscape = w > h;
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

    var computed = view.getComputedStyle(element);
    var vertical = VERTICAL_WRITING_MODE.test((computed && computed.writingMode) || '');
    setVariant('d', w, h, vertical);
    setVariant('s', minW, minH, vertical);
    setVariant('l', maxW, maxH, vertical);
  }

  var frame = 0;

  function flush(): void {
    frame = 0;
    update();
  }

  function schedule(): void {
    if (!view.requestAnimationFrame) update();
    else if (!frame) frame = view.requestAnimationFrame(flush);
  }

  function destroy(): void {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    view.removeEventListener('resize', schedule);
    view.removeEventListener('orientationchange', schedule);
    view.removeEventListener('pageshow', schedule);
    if (viewport) viewport.removeEventListener('resize', schedule);
  }

  update();
  view.addEventListener('resize', schedule);
  view.addEventListener('orientationchange', schedule);
  view.addEventListener('pageshow', schedule);
  if (viewport) viewport.addEventListener('resize', schedule);

  return { update: update, destroy: destroy };
}

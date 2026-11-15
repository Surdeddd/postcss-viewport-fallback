/**
 * What a browser sets through every shorthand and alias it knows, as the content of
 * chrome-shorthands.json. Paste the function into the console of a current Chrome and call it.
 */
function captureShorthands() {
  const style = document.createElement('div').style;
  const dashed = (name) =>
    name
      .replace(/^(webkit|moz|ms)(?=[A-Z])/, '-$1')
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  const names = new Set();
  for (const key in style) {
    if (typeof style[key] === 'string' && key !== 'cssText') names.add(dashed(key));
  }

  const expansions = {};
  for (const name of [...names].sort()) {
    style.cssText = '';
    style.setProperty(name, 'inherit');
    const set = Array.from(style).sort();
    if (set.length > 0 && !(set.length === 1 && set[0] === name)) expansions[name] = set;
  }
  const browser = /Chrome\/\d+/.exec(navigator.userAgent)[0];
  return JSON.stringify({ browser, expansions }, null, 2);
}

captureShorthands();

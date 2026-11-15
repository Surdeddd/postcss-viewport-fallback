import { describe, it, expect } from 'vitest';
import postcss from 'postcss';
import type { Root } from 'postcss';
import plugin from '../src';

/** A stylesheet the way Tailwind or postcss-js hand it over: nodes made in code, no whitespace of their own. */
function sheet(): Root {
  const guarded = postcss.rule({ selector: '.a' });
  guarded.append(
    { prop: 'height', value: 'calc(100dvh - var(--h))' },
    { prop: 'height', value: '5px' }
  );

  const plain = postcss.rule({ selector: '.b' });
  plain.append({ prop: 'width', value: '100dvw' });

  const hover = postcss.rule({ selector: '&:hover' });
  hover.append({ prop: 'top', value: '0' });
  const nested = postcss.rule({ selector: '.c' });
  nested.append({ prop: 'top', value: 'var(--t,1dvh)' }, hover);

  const to = postcss.rule({ selector: 'to' });
  to.append({ prop: 'height', value: 'var(--x,1dvh)' });
  const keyframes = postcss.atRule({ name: 'keyframes', params: 'k' });
  keyframes.append(to);

  const layer = postcss.atRule({ name: 'layer', params: 'utilities' });
  layer.append(guarded, plain, nested, keyframes);
  return postcss.root().append(layer);
}

describe('a stylesheet built in code, without whitespace of its own', () => {
  it('is printed by PostCSS the same way with the blocks of this plugin in it', async () => {
    const { css } = await postcss([plugin()]).process(sheet(), { from: undefined });
    expect(css).toBe(
      [
        '@layer utilities {',
        '    .a {',
        '        height: calc(100vh - var(--h));',
        '        height: 5px',
        '    }',
        '    @supports (height: 1dvh) {',
        '        .a {',
        '            height: calc(100dvh - var(--h));',
        '            height: 5px',
        '        }',
        '    }',
        '    .b {',
        '        width: 100vw;',
        '        width: 100dvw',
        '    }',
        '    .c {',
        '        top: var(--t,1vh);',
        '        @supports (height: 1dvh) {',
        '            top: var(--t,1dvh)',
        '        }',
        '        &:hover {',
        '            top: 0',
        '        }',
        '    }',
        '    @keyframes k {',
        '        to {',
        '            height: var(--x,1vh)',
        '        }',
        '    }',
        '    @supports (height: 1dvh) {',
        '        @keyframes k {',
        '            to {',
        '                height: var(--x,1dvh)',
        '            }',
        '        }',
        '    }',
        '}',
      ].join('\n')
    );
  });

  it('closes the blocks of this plugin the way the stylesheet closes its own', async () => {
    const root = sheet();
    root.walk((node) => {
      if (node.type === 'rule' || node.type === 'atrule') node.raws.semicolon = true;
    });
    const { css } = await postcss([plugin()]).process(root, { from: undefined });
    expect(css).toContain(
      [
        '    @supports (height: 1dvh) {',
        '        .a {',
        '            height: calc(100dvh - var(--h));',
        '            height: 5px;',
        '        }',
        '    }',
      ].join('\n')
    );
    expect(css).toContain(
      [
        '        @supports (height: 1dvh) {',
        '            top: var(--t,1dvh);',
        '        }',
      ].join('\n')
    );
  });

  it('prints the comment of a switched-off copy like every other node', async () => {
    const rule = postcss.rule({ selector: '.a' });
    rule.append(
      { prop: 'height', value: 'var(--x,1dvh)' },
      postcss.comment({ text: 'postcss-viewport-fallback: off' }),
      { prop: 'height', value: '2cqh' }
    );
    const { css } = await postcss([plugin({ customUnits: { cqh: 'vh' } })]).process(
      postcss.root().append(rule),
      { from: undefined }
    );
    expect(css).toBe(
      [
        '.a {',
        '    height: var(--x,1vh);',
        '    /* postcss-viewport-fallback: off */',
        '    height: 2cqh',
        '}',
        '@supports (height: 1dvh) {',
        '    .a {',
        '        height: var(--x,1dvh);',
        '        /* postcss-viewport-fallback: off */',
        '        height: 2cqh',
        '    }',
        '}',
      ].join('\n')
    );
  });

  it('still writes the block of a list of declarations on one line', async () => {
    const list = postcss.root().append({ prop: 'height', value: 'var(--x,1dvh)' });
    const { css } = await postcss([plugin({ fragmentGuards: true })]).process(list, {
      from: undefined,
    });
    expect(css).toBe(
      'height: var(--x,1vh); @supports (height: 1dvh) { height: var(--x,1dvh) }'
    );
  });
});

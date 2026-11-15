import type { ChildNode, Container } from 'postcss';

type Pair = [before: number, after: number];
type Block = Container & ChildNode;

const DP_LIMIT = 4_000_000;

/** A node without what it holds: a declaration, a comment, or the opening of a block. */
function headOf(node: ChildNode): string {
  if (node.type === 'decl') {
    return `${node.prop}:${node.value}${node.important ? '!' : ''}`;
  }
  if (node.type === 'rule') return `{${node.selector}`;
  if (node.type === 'atrule') return `@${node.name} ${node.params}`;
  return `/*${node.text}`;
}

/** A node with everything it holds, so that two equal ones are the same piece of CSS. */
function wholeOf(node: ChildNode): string {
  const inner = 'nodes' in node && node.nodes ? node.nodes.map(wholeOf).join(';') : '';
  return `${headOf(node)}{${inner}}`;
}

/** What a block is, apart from its prelude: a rule, or an at-rule of some name. */
function kindOf(node: ChildNode): string | undefined {
  if (node.type === 'rule') return 'rule';
  if (node.type === 'atrule' && node.nodes) return `@${node.name.toLowerCase()}`;
  return undefined;
}

/** The longest run of equal entries of two lists, in order, taking the earliest counterparts. */
function commonRun(before: string[], after: string[]): Pair[] {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) {
    head++;
  }
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }

  const pairs: Pair[] = [];
  for (let i = 0; i < head; i++) pairs.push([i, i]);

  const rows = before.length - head - tail;
  const cols = after.length - head - tail;
  if (rows * cols <= DP_LIMIT) {
    const width = cols + 1;
    const length = new Uint32Array((rows + 1) * width);
    for (let i = rows - 1; i >= 0; i--) {
      for (let j = cols - 1; j >= 0; j--) {
        length[i * width + j] =
          before[head + i] === after[head + j]
            ? length[(i + 1) * width + j + 1] + 1
            : Math.max(length[(i + 1) * width + j], length[i * width + j + 1]);
      }
    }
    for (let i = 0, j = 0; i < rows && j < cols;) {
      if (before[head + i] === after[head + j]) pairs.push([head + i++, head + j++]);
      else if (length[(i + 1) * width + j] >= length[i * width + j + 1]) i++;
      else j++;
    }
  }

  for (let i = tail; i > 0; i--) pairs.push([before.length - i, after.length - i]);
  return pairs;
}

/** Pair the nodes two lists have in common by a key; what lies between the pairs is a gap. */
function align(
  old: ChildNode[],
  now: ChildNode[],
  key: (node: ChildNode) => string,
  paired: (before: ChildNode, after: ChildNode) => void,
  gap: (before: ChildNode[], after: ChildNode[]) => void
): void {
  let from = 0;
  let at = 0;
  for (const [i, j] of [
    ...commonRun(old.map(key), now.map(key)),
    [old.length, now.length],
  ]) {
    gap(old.slice(from, i), now.slice(at, j));
    if (j < now.length) paired(old[i], now[j]);
    from = i + 1;
    at = j + 1;
  }
}

function markAll(node: ChildNode, written: Set<number>): void {
  const { start, end } = node.source!;
  for (let line = start!.line; line <= end!.line; line++) written.add(line);
}

/** The lines of a block up to its first child: where its selector or its condition stands. */
function markPrelude(node: Block, written: Set<number>): void {
  const first = node.source!.start!.line;
  const body = node.first?.source!.start!.line ?? first;
  for (let line = first; line < Math.max(body, first + 1); line++) written.add(line);
}

/** Blocks of one kind, in order, are the same block with another prelude; the rest is new. */
function settle(old: ChildNode[], now: ChildNode[], written: Set<number>): void {
  const partners = old.filter((node) => kindOf(node));
  for (const node of now) {
    const kind = kindOf(node);
    if (kind && partners[0] && kindOf(partners[0]) === kind) {
      markPrelude(node as Block, written);
      compare(partners.shift() as Block, node as Block, written);
    } else markAll(node, written);
  }
}

function compare(before: Container, after: Container, written: Set<number>): void {
  align(
    before.nodes ?? [],
    after.nodes ?? [],
    wholeOf,
    () => undefined,
    (old, now) =>
      align(
        old,
        now,
        headOf,
        (was, is) => compare(was as Block, is as Block, written),
        (left, added) => settle(left, added, written)
      )
  );
}

/** The lines of the output that have no counterpart in the input: what the plugin wrote. */
export function writtenLines(input: Container, output: Container): Set<number> {
  const written = new Set<number>();
  compare(input, output, written);
  return written;
}

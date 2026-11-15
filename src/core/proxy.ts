import type { ChildNode } from 'postcss';

/** Raw node behind a visitor proxy; raw nodes return themselves. */
export function unproxy<T extends object>(node: T): T {
  return (node as T & { proxyOf: T }).proxyOf;
}

/** Have PostCSS visit a node again after a change made outside a visitor proxy. */
export function revisit(node: ChildNode): void {
  (node as unknown as { markDirty(): void }).markDirty();
}

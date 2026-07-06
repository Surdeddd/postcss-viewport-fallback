import type { ChildNode } from 'postcss';

export function unproxy<T extends ChildNode>(node: T): T {
  return (node as T & { proxyOf?: T }).proxyOf ?? node;
}

export interface TransformMeta {
  /** Property name, or `@media` / `@container` for an at-rule prelude. */
  prop: string;
  original: string;
  fallback: string;

  file?: string | undefined;

  /** Selector of the nearest enclosing style rule; undefined outside of any rule. */
  selector?: string | undefined;
  loc?: {
    line: number;
    column: number;
  };
}

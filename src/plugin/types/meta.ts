export interface TransformMeta {
  prop: string;
  original: string;
  fallback: string;

  file?: string | undefined;

  selector?: string | undefined;
  loc?: {
    line: number;
    column: number;
  };
}

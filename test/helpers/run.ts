import postcss from 'postcss';
import type { ProcessOptions, Result } from 'postcss';
import plugin from '../../src';
import type { ViewportFallbackOptions } from '../../src';

export function process(
  css: string,
  opts: ViewportFallbackOptions = {},
  processOpts: ProcessOptions = {}
): Promise<Result> {
  return postcss([plugin(opts)]).process(css, {
    from: undefined,
    ...processOpts,
  }) as unknown as Promise<Result>;
}

export async function run(
  css: string,
  opts: ViewportFallbackOptions = {},
  processOpts: ProcessOptions = {}
): Promise<string> {
  return (await process(css, opts, processOpts)).css;
}

export async function warningsOf(
  css: string,
  opts: ViewportFallbackOptions = {},
  processOpts: ProcessOptions = {}
): Promise<string[]> {
  return (await process(css, opts, processOpts))
    .warnings()
    .map((warning) => warning.text);
}

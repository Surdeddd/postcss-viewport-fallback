export function isVerbose(debug: boolean | 'minimal' | 'verbose' | undefined): boolean {
  return debug === true || debug === 'verbose';
}

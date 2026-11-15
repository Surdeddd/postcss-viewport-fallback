/** Indentation of the line a node starts on, read from its `raws.before`. */
export function indentOf(before: string): string {
  const lineStart = before.lastIndexOf('\n');
  return lineStart === -1 ? '' : before.slice(lineStart + 1);
}

/** Line terminator used by a whitespace run; LF unless it contains CRLF. */
export function newlineOf(before: string): string {
  return before.includes('\r\n') ? '\r\n' : '\n';
}

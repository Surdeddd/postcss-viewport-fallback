/** A `require` that finds nothing: the optional Node-only peers do not exist in a browser. */
export function createRequire(): { (id: string): never; resolve(id: string): never } {
  const missing = (id: string): never => {
    throw Object.assign(new Error(`Cannot find module '${id}'`), {
      code: 'MODULE_NOT_FOUND',
    });
  };
  return Object.assign(missing, { resolve: missing });
}

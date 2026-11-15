export const dirname = (path: string): string => path.replace(/\/[^/]*$/, '') || '/';
export const resolve = (...paths: string[]): string => paths[paths.length - 1];
export const join = (...paths: string[]): string => paths.join('/');

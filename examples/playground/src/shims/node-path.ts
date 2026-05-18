// Browser shim for `node:path` (and bare `path`). Real-ish POSIX implementations
// for the names @rozie/core + transitive deps (postcss) actually consume:
// dirname, isAbsolute, join, resolve, relative, sep.
// Not POSIX-spec-complete — only safe-no-ops for the single-buffer playground
// path. If a feature ever needs real path math, swap to `pathe`.

export const sep = '/';

export function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  if (i < 0) return '.';
  if (i === 0) return '/';
  return p.slice(0, i);
}

export function isAbsolute(p: string): boolean {
  return typeof p === 'string' && p.startsWith('/');
}

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function resolve(...parts: string[]): string {
  return '/' + parts.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\//, '');
}

export function relative(from: string, to: string): string {
  if (from === to) return '';
  return to.startsWith(from + '/') ? to.slice(from.length + 1) : to;
}

export const posix = { sep, dirname, isAbsolute, join, resolve, relative };

export default { sep, dirname, isAbsolute, join, resolve, relative, posix };

// Browser shim for `node:path`. The resolver may path-massage strings even
// when it never hits the filesystem, so these are cheap real implementations
// rather than throws. They are NOT POSIX-spec-complete — they only need to be
// safe-no-ops for the single-buffer playground path. If a future feature
// requires real path math, swap to `pathe` (browser-friendly path module).

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

export default { dirname, isAbsolute, join, resolve };

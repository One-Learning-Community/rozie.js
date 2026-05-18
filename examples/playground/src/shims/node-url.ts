// Browser shim for `node:url` (and bare `url`). Postcss imports `pathToFileURL`
// and `fileURLToPath` at the top of map-generator.js to build sourcemap URLs.
// The playground passes `sourceMap: false` so neither is invoked, but the
// named bindings must resolve at module-load time or Vite throws.

export function pathToFileURL(p: string): URL {
  return new URL('file://' + (p.startsWith('/') ? p : '/' + p));
}

export function fileURLToPath(u: string | URL): string {
  return String(u).replace(/^file:\/\//, '');
}

export default { pathToFileURL, fileURLToPath };

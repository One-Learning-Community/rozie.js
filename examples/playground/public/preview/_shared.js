// Shared helpers used by all 6 harness HTML files. Served as a static asset
// from /preview/_shared.js so each harness can `import ... from './_shared.js'`.

// esbuild-wasm singleton — initialized once, reused across renders.
let esbuildReady = null;

/**
 * Initialize esbuild-wasm and return its `transform` function.
 * Called by harnesses that need TSX → JS or TS → JS lowering.
 *
 * esbuild-wasm ships as CJS; esm.sh wraps it so the API lives under the
 * default export (not as top-level named exports). Pull from `.default ?? ns`
 * so we work against either shape if esm.sh's wrapper ever changes.
 */
export async function getEsbuildTransform() {
  if (!esbuildReady) {
    esbuildReady = (async () => {
      const ns = await import('https://esm.sh/esbuild-wasm@0.24.0');
      const esbuild = ns.default ?? ns;
      await esbuild.initialize({
        wasmURL: 'https://esm.sh/esbuild-wasm@0.24.0/esbuild.wasm',
        worker: false,
      });
      return esbuild.transform;
    })();
  }
  return esbuildReady;
}

/**
 * Strip / stub imports the compiled Rozie output may emit that the iframe
 * can't resolve. Currently handles:
 *   - `import styles from './X.module.css'` (any CSS-module variant) →
 *     `const styles = new Proxy({}, { get: (_, k) => String(k) })` — class
 *     refs resolve to their literal name; the CSS itself doesn't get
 *     injected, but the JSX `className={styles.foo}` lookup still produces
 *     a valid string so the markup renders.
 *   - `import './X.module.css'` (bare side-effect import) → dropped.
 *   - `import './X.css'` (plain side-effect CSS import) → dropped.
 */
export function stubUnresolvableImports(code) {
  let out = code;
  // `import <name> from './*.css'` → const name = proxy
  out = out.replace(
    /import\s+(\w+)\s+from\s+['"][^'"]+\.css['"]\s*;?/g,
    'const $1 = new Proxy({}, { get: (_, k) => String(k) });',
  );
  // `import './*.css'` bare side-effect import → drop
  out = out.replace(/import\s+['"][^'"]+\.css['"]\s*;?/g, '');
  return out;
}

/**
 * Eval an ESM module from a code string by minting a blob URL and dynamically
 * importing it. The browser resolves any bare-specifier imports via the
 * harness's <importmap>.
 */
export async function importFromString(code) {
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    // Revoke after a tick so the import has fully resolved.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Rewrite `from './Foo'` / `import './Foo'` style relative specifiers in
 * `code` to point at `blobMap[Foo]` blob: URLs. Used by `importBundleWith`
 * so the entry module can dynamic-import its compiled sibling modules even
 * though the entry itself lives at a non-hierarchical `blob:` base URL
 * (which the HTML spec forbids resolving relative URLs against).
 *
 * The regex is scoped to `from ` / `import ` heads so we never touch
 * unrelated string literals that happen to look like relative paths.
 * Matches both bare-basename (`'./SortableList'`) and with-extension
 * (`'./SortableList.js'`, `'./SortableList.svelte'`) forms.
 *
 * Pass-through for anything not in the map — so unrelated imports of
 * `./foo/bar` or relative CSS paths fall through to the existing
 * stubUnresolvableImports pass (or fail loudly downstream, which is
 * already the case today).
 */
export function rewriteRelativeImports(code, blobMap) {
  return code.replace(
    /(\b(?:from|import)\s+)(['"])\.\/([\w-]+)(?:\.[\w]+)?\2/g,
    (m, head, q, name) => (blobMap[name] ? `${head}${q}${blobMap[name]}${q}` : m),
  );
}

/**
 * Orchestrates the blob-URL bundle dance for a multi-file snippet:
 *   1. Transform every sibling via `transformFn` (per-target pipeline:
 *      esbuild tsx/ts, @vue/compiler-sfc, svelte.compile, etc.).
 *   2. Mint a blob: URL per sibling and remember it by basename.
 *   3. Rewrite the entry's `./<basename>` relative specifiers to point at
 *      those sibling blob URLs.
 *   4. Transform the rewritten entry via the same `transformFn`.
 *   5. Mint the entry blob URL, dynamic-import it, return the module.
 *   6. Revoke every blob URL on a microtask so the dynamic-import resolves
 *      before garbage collection.
 *
 * Empty `siblingsCode` (single-file snippets) collapses to "transform entry,
 * import, return" — i.e. equivalent to `importFromString(transformFn(entry))`.
 *
 * `siblingsCode` is `{ basename: rozieCompiledSource }` — the same shape the
 * playground's `compileBundleRuntime` returns. The harness's `transformFn`
 * lowers each into target-executable JS (or for Vue, an SFC → script-and-style
 * pair where styles are document.head-injected as a side-effect inside
 * `transformFn` itself).
 *
 * @param {(src: string) => Promise<string>} transformFn
 * @param {string} entryCode
 * @param {Record<string, string>} siblingsCode
 * @returns {Promise<any>} the imported entry module
 */
export async function importBundleWith(transformFn, entryCode, siblingsCode) {
  const siblingBlobs = {};
  const allBlobUrls = [];
  try {
    for (const [name, src] of Object.entries(siblingsCode || {})) {
      const transformedJs = await transformFn(src);
      const blob = new Blob([transformedJs], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      siblingBlobs[name] = url;
      allBlobUrls.push(url);
    }
    const rewritten = rewriteRelativeImports(entryCode, siblingBlobs);
    const entryJs = await transformFn(rewritten);
    const entryBlob = new Blob([entryJs], { type: 'text/javascript' });
    const entryUrl = URL.createObjectURL(entryBlob);
    allBlobUrls.push(entryUrl);
    return await import(/* @vite-ignore */ entryUrl);
  } finally {
    // Revoke after a tick so any still-resolving dynamic imports complete.
    setTimeout(() => {
      for (const u of allBlobUrls) URL.revokeObjectURL(u);
    }, 0);
  }
}

/**
 * Standard harness boot — wires the render message handler, signals ready,
 * surfaces errors back to the parent.
 *
 * The render fn receives the full payload `{ code, css, siblings }`.
 *   - `code` is the compiled entry source
 *   - `css` is the React-sidecar CSS string (other targets inline CSS into
 *     the component module and ignore this field)
 *   - `siblings` is the basename → compiled-source map for multi-file bundle
 *     snippets (empty `{}` for single-file snippets); harnesses pass it
 *     straight to `importBundleWith(transformFn, code, siblings)`.
 *
 * @param {(payload: { code: string, css: string, siblings: Record<string, string> }) => Promise<void>} onRender
 */
export function bootHarness(onRender) {
  let renderToken = 0;
  window.addEventListener('message', async (e) => {
    const data = e.data;
    if (!data || data.type !== 'render') return;
    const token = ++renderToken;
    try {
      await onRender({
        code: data.code,
        css: data.css ?? '',
        siblings: data.siblings ?? {},
      });
      // Only confirm if a newer render hasn't superseded us.
      if (token === renderToken) {
        parent.postMessage({ type: 'rendered' }, '*');
      }
    } catch (err) {
      if (token === renderToken) {
        const msg = err && err.stack ? err.stack : String(err);
        parent.postMessage({ type: 'error', message: msg.split('\n')[0] }, '*');
        console.error('[harness] render failed', err);
      }
    }
  });
  // Signal readiness exactly once on harness load.
  parent.postMessage({ type: 'ready' }, '*');
}

/**
 * Install/replace the sidecar <style> tag used for CSS that came in over the
 * postMessage sidecar (not embedded in the compiled component code).
 * Idempotent — re-calling replaces the prior CSS.
 */
export function setSidecarCss(css) {
  let tag = document.getElementById('__rozie_sidecar_css');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = '__rozie_sidecar_css';
    document.head.appendChild(tag);
  }
  tag.textContent = css || '';
}

/**
 * Unmount whatever's in the host element. Frameworks have different teardown
 * idioms — for everything but React/Solid, "blow away the children" works.
 */
export function clearHost(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

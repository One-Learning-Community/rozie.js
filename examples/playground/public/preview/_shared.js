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
 * Standard harness boot — wires the render message handler, signals ready,
 * surfaces errors back to the parent.
 *
 * The render fn receives the full payload `{ code, css }`. Targets that emit
 * scoped CSS as part of the compiled code (Vue SFC, Svelte css:'injected',
 * Angular @Component({styles}), Solid <style>, Lit static styles) can ignore
 * `css`. React emits CSS to a separate sidecar — its harness reads `css` and
 * injects it via `setSidecarCss()`.
 *
 * @param {(payload: { code: string, css: string }) => Promise<void>} onRender
 */
export function bootHarness(onRender) {
  let renderToken = 0;
  window.addEventListener('message', async (e) => {
    const data = e.data;
    if (!data || data.type !== 'render') return;
    const token = ++renderToken;
    try {
      await onRender({ code: data.code, css: data.css ?? '' });
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

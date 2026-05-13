/**
 * injectGlobalStyles — D-LIT-15 idempotent global-styles injection for
 * `@rozie/runtime-lit`.
 *
 * Lit components live inside a shadow root, so `<style>` blocks in
 * `static styles = css\`...\`` are scoped automatically. The `:root { ... }`
 * escape hatch in Rozie's `<style>` block needs to land in the LIGHT DOM —
 * specifically the document head — so that CSS custom properties (e.g.
 * `--rozie-modal-z: 9999`) reach `document.documentElement`.
 *
 * The Rozie Lit emitter generates module-level calls like
 * `injectGlobalStyles('rozie-modal-global', ':root { ... }')` which run once
 * per module load. The `id` parameter is a stable per-component string;
 * subsequent calls with the same id are silently no-ops (idempotent).
 *
 * Idempotency strategy: every injected `<style>` element carries a
 * `data-rozie-global-id` attribute matching the supplied `id`. A second call
 * with the same id checks for the marker and bails. This means re-evaluating
 * the module (Vite HMR boundary crossings, test re-imports, etc.) does NOT
 * pile up duplicate `<style>` tags.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

const STYLE_MARKER_ATTR = 'data-rozie-global-id';

export function injectGlobalStyles(id: string, css: string): void {
  // SSR / non-browser guard: silently no-op if `document` isn't defined
  // (e.g., the module loads in a Node test runner without happy-dom).
  if (typeof document === 'undefined') return;

  const existing = document.head.querySelector(
    `style[${STYLE_MARKER_ATTR}="${id.replace(/"/g, '\\"')}"]`,
  );
  if (existing !== null) {
    // Already injected — preserve idempotency, do not re-inject.
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.setAttribute(STYLE_MARKER_ATTR, id);
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

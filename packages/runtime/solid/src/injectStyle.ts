/**
 * injectStyle — Solid runtime helper for per-component style head-injection.
 *
 * Why this exists. Solid has no CSS Modules pipeline analogous to Vite's
 * React CSS Modules, so Rozie's pre-pre-Phase-16 Solid emitter inlined each
 * component's scoped CSS as a sibling `<style>` JSX element in the rendered
 * tree. That worked for the in-isolation case but broke same-specificity
 * cascade when a consumer composed a wrapper: the wrapper's `<style>` got
 * rendered AFTER the consumer's `<style>` (one wrapper `<style>` per
 * wrapper INSTANCE, all positioned as children of the consumer's container),
 * so source-order made the wrapper's same-specificity rules win — wiping
 * the consumer's `.extra-variant { font-weight: 600 }` overrides in the
 * `ThemedButtonConsumer · solid` matrix VR cell (a `.btn { font: inherit }`
 * shorthand from the wrapper reset font-weight back to "normal").
 *
 * Fix. Hoist each component's `<style>` content to `document.head` ONCE per
 * component (via this helper), called as a module-top side effect when the
 * emitted Solid component module is first imported. Wrapper modules are
 * imported BEFORE consumer modules (consumer's `import X from '...'`
 * resolves wrapper first), so wrapper styles land in `<head>` first and
 * consumer styles second — restoring the source-order cascade the other
 * five targets achieve via their respective per-framework style pipelines
 * (Vue `<style scoped>`, React CSS Modules, Svelte `:global { }`,
 * Angular `ViewEncapsulation.Emulated`, Lit `static styles = css\`\``).
 *
 * Cache. A module-scoped `Map<key, HTMLStyleElement>` deduplicates by the
 * caller-supplied key (typically the per-component scope hash). HMR-safe:
 * when an already-injected key receives different CSS text, the existing
 * `<style>` element's `textContent` is updated in place rather than a new
 * element being appended — so Vite HMR style edits propagate immediately.
 *
 * SSR. `typeof document === 'undefined'` is a no-op. Rozie's v1 Solid scope
 * is client-side rendering; SSR will need its own server-side style stream
 * mechanism (Solid Start uses `useAssets()`) when added later.
 *
 * @public
 */

const __ROZIE_INJECTED = new Map<string, HTMLStyleElement>();

export function __rozieInjectStyle(key: string, css: string): void {
  if (typeof document === 'undefined') return;
  const existing = __ROZIE_INJECTED.get(key);
  if (existing) {
    // HMR / re-injection path: refresh the textContent if the css string
    // changed (don't append a duplicate `<style>` element).
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const el = document.createElement('style');
  el.setAttribute('data-rozie-style', key);
  el.textContent = css;
  document.head.appendChild(el);
  __ROZIE_INJECTED.set(key, el);
}

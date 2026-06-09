/**
 * adoptDocumentStyles — bridge the document's global stylesheets INTO a Lit
 * component's shadow root (Item 3, the engine-CSS shadow bridge).
 *
 * Engine-wrapper components (Cropper.js, MapLibre GL, …) tell the consumer to
 * import the engine's CSS globally (`import 'cropperjs/dist/cropper.css'`).
 * That stylesheet lands in the LIGHT DOM (document head, via the bundler) and
 * styles the engine's DOM on the 5 light-DOM targets, where the engine builds
 * its chrome as light-DOM siblings. On the **Lit** target the engine builds
 * that same chrome INSIDE the wrapper's shadow root, and global CSS does not
 * cross a shadow boundary — so the engine DOM renders unstyled.
 *
 * The Rozie Lit emitter generates a `adoptDocumentStyles(this)` call in
 * `firstUpdated()` whenever the `<rozie adopt-document-styles>` envelope
 * attribute is present. This helper clones every SAME-ORIGIN document
 * stylesheet into a constructable `CSSStyleSheet` and appends them to the
 * host's `shadowRoot.adoptedStyleSheets`, so the global engine CSS reaches the
 * shadow-rooted engine DOM. It is a no-op on the other 5 targets (the emitter
 * never calls it there — their engine DOM is in light DOM already).
 *
 * Why clone rather than share: a `<style>`/`<link>`-backed `CSSStyleSheet` is
 * NOT constructable and cannot be placed into `adoptedStyleSheets`, so its
 * rules are re-serialized into a fresh constructable sheet.
 *
 * Cross-origin stylesheets (e.g. a CDN `<link>`) throw on `.cssRules` access
 * (CORS) — they are skipped silently. The consumer's bundled engine CSS is
 * same-origin, so it is reachable. Appending AFTER the component's own
 * `static styles` means document rules win on a selector tie, matching the
 * `adoptConsumerStyles` precedence convention.
 *
 * Idempotent: the host is tagged after the first successful adoption so a
 * reconnect / re-render does not pile up duplicate sheets.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

interface AdoptDocumentStylesHost {
  shadowRoot: ShadowRoot | null;
}

const ADOPTED_HOSTS = new WeakSet<object>();

export function adoptDocumentStyles(host: AdoptDocumentStylesHost): void {
  // SSR / non-browser guard.
  /* v8 ignore next 2 -- SSR guard: happy-dom defines `document`, so this is
     unreachable under the vitest happy-dom env. */
  if (typeof document === 'undefined') return;

  const root = host.shadowRoot;
  if (!root) return;

  // Constructable-stylesheet support guard (Baseline since 2023; the Lit
  // targets require it for `static styles` anyway, so this is belt-and-braces).
  if (
    typeof CSSStyleSheet === 'undefined' ||
    typeof root.adoptedStyleSheets === 'undefined'
  ) {
    return;
  }

  // Idempotency: bail if already adopted for this host (reconnect / re-render).
  if (ADOPTED_HOSTS.has(host)) return;

  const cloned: CSSStyleSheet[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      // Cross-origin sheets throw here (CORS) — skip them.
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    let cssText = '';
    for (const rule of Array.from(rules)) {
      // `@import` rules cannot be re-inserted via replaceSync and would throw;
      // skip them (the imported sheet appears as its own entry in
      // document.styleSheets and is cloned on its own).
      if (typeof CSSImportRule !== 'undefined' && rule instanceof CSSImportRule) {
        continue;
      }
      cssText += rule.cssText + '\n';
    }
    if (cssText.length === 0) continue;
    try {
      const constructed = new CSSStyleSheet();
      constructed.replaceSync(cssText);
      cloned.push(constructed);
    } catch {
      // A non-serialisable rule slipped through — skip this sheet rather than
      // abort the whole bridge.
      continue;
    }
  }

  if (cloned.length === 0) return;
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...cloned];
  ADOPTED_HOSTS.add(host);
}

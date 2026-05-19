/**
 * adoptConsumerStyles — bridge consumer-side stylesheets across nested Lit
 * shadow roots when the consumer fills a property-fill slot on a Lit producer.
 *
 * Phase 07.5 (commit ec24d26) switched consumer-side scoped destructured fills
 * and portal fills from light-DOM projection (`<element slot="X">content`,
 * staying in the consumer's shadow scope and reachable by the consumer's
 * adopted stylesheets) to a property-fill function (`<rozie-foo .X=${fn}>`)
 * whose returned html template renders directly inside the PRODUCER's shadow
 * root. The producer's shadow root has its own `adoptedStyleSheets` array,
 * and Lit's per-component `static styles` populates only that array — the
 * consumer's stylesheets do NOT cascade across the shadow boundary.
 *
 * The Web Components solution is to share the same constructable
 * `CSSStyleSheet` instances across both shadow roots' `adoptedStyleSheets`
 * lists. No copy, no FOUC, identical specificity semantics.
 *
 * This helper:
 *   - Extracts `CSSStyleSheet` references from the consumer's Lit
 *     `CSSResultGroup` (`static styles`).
 *   - Idempotently appends them to the producer's
 *     `shadowRoot.adoptedStyleSheets` (skips entries already present).
 *   - Defers until the producer is upgraded + has its shadow root attached
 *     when called pre-firstUpdated.
 *
 * Specificity note: appending the consumer's stylesheets AFTER the producer's
 * own static styles means consumer rules win on selector-tie. This matches
 * the producer-styles-don't-leak-into-projected-content semantics the other
 * 5 targets get for free via attribute-selector scoping.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

interface CssResultLike {
  styleSheet?: CSSStyleSheet | null;
}

type CSSResultGroupLike =
  | CssResultLike
  | CSSStyleSheet
  | ReadonlyArray<CSSResultGroupLike>;

function collectSheets(group: CSSResultGroupLike | undefined): CSSStyleSheet[] {
  const out: CSSStyleSheet[] = [];
  const visit = (g: CSSResultGroupLike | undefined): void => {
    if (g === undefined || g === null) return;
    if (Array.isArray(g)) {
      for (const item of g) visit(item);
      return;
    }
    if (typeof CSSStyleSheet !== 'undefined' && g instanceof CSSStyleSheet) {
      out.push(g);
      return;
    }
    const sheet = (g as CssResultLike).styleSheet;
    if (sheet) out.push(sheet);
  };
  visit(group);
  return out;
}

function adoptInto(shadowRoot: ShadowRoot, sheets: CSSStyleSheet[]): void {
  const current = shadowRoot.adoptedStyleSheets;
  const toAdd: CSSStyleSheet[] = [];
  for (const sheet of sheets) {
    if (!current.includes(sheet)) toAdd.push(sheet);
  }
  if (toAdd.length === 0) return;
  shadowRoot.adoptedStyleSheets = [...current, ...toAdd];
}

export function adoptConsumerStyles(
  producerEl: Element,
  consumerStyles: CSSResultGroupLike | undefined,
): void {
  if (typeof document === 'undefined') return;
  const sheets = collectSheets(consumerStyles);
  if (sheets.length === 0) return;

  const trySync = (): boolean => {
    const sr = (producerEl as Element & { shadowRoot: ShadowRoot | null })
      .shadowRoot;
    if (!sr) return false;
    adoptInto(sr, sheets);
    return true;
  };

  if (trySync()) return;

  const localName = producerEl.localName;
  // Producer may not be upgraded yet (consumer's render runs before the
  // producer's connectedCallback wires the shadow root). Defer until both
  // the custom element class is registered AND a frame has elapsed for
  // firstUpdated to attach the shadow root.
  customElements.whenDefined(localName).then(() => {
    if (trySync()) return;
    requestAnimationFrame(() => {
      trySync();
    });
  });
}

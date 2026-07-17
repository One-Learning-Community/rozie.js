import type { Page } from '@playwright/test';

/**
 * _shadow-utils.ts — shared shadow-DOM-piercing browser-context helpers for
 * the visual-regression specs (quick 260716-npt Finding 3, Fix C).
 *
 * The `walk`/`deep`/`collect` shadow-piercing closures below were copy-pasted
 * (byte-identical or near-identical) across command-palette.spec.ts,
 * data-table-edit.spec.ts, data-table-grid-rowedit.spec.ts, and
 * rete-flow.spec.ts. This module extracts the handful of shapes that ARE
 * mechanically identical (or trivially parametrizable into one identical
 * shape) into ONE place.
 *
 * IMPORTANT (Playwright constraint — why some walkers were deliberately NOT
 * extracted here): `page.evaluate(fn, arg)` serializes `fn` via
 * `Function.prototype.toString()` and re-executes that TEXT in the browser.
 * A helper CALLED FROM WITHIN a separately-defined `page.evaluate(() => {
 * ... })` closure is not part of that closure's own source text, so
 * referencing an imported helper from inside another inline evaluate
 * callback throws `ReferenceError` in the browser at runtime — imports do
 * NOT cross the Playwright evaluate boundary. Every export below is
 * therefore designed to be passed DIRECTLY as the evaluate callback (e.g.
 * `page.evaluate(deepActiveElementProbeInPage, 'text')`), never called from
 * inside a wrapping closure. Walkers that are entangled with FURTHER
 * multi-step computation inside the SAME evaluate call (geometry math,
 * pointer-event dispatch, etc. — see rete-flow.spec.ts's `deepQueryAll` and
 * command-palette.spec.ts's `deepHitAtLastMenuItem`) do not fit this shape
 * cleanly and are left as-is, noted at their call sites.
 */

/**
 * Every element matching `selector`, recursively piercing every open shadow
 * root — light-DOM matches at each level before descending into a child's
 * shadow root. Returns raw `Element[]`, so this must be called from WITHIN
 * an evaluate callback that stays in the browser (Elements do not survive
 * the evaluate serialization boundary) — see `deepQuerySelectorAllCount`
 * below for the Node-side wrapper.
 */
function deepQuerySelectorAllInPage(selector: string): Element[] {
  const out: Element[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    out.push(...Array.from(root.querySelectorAll(selector)));
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) walk(sr);
    }
  };
  walk(document);
  return out;
}

/** Count of elements matching `selector`, shadow-piercing (replaces the many
 *  copy-pasted `let total = 0; const walk = ... total += ...` closures). */
export async function deepQuerySelectorAllCount(page: Page, selector: string): Promise<number> {
  const matches = await page.evaluate(deepQuerySelectorAllInPage, selector);
  return matches.length;
}

/** Trimmed `textContent` of every element matching `selector`, in the same
 *  root-first-then-shadow-descend order as `deepQuerySelectorAllInPage`. Pass
 *  DIRECTLY as a `page.evaluate` callback: `page.evaluate(deepQuerySelectorAllTextInPage, selector)`. */
export function deepQuerySelectorAllTextInPage(selector: string): string[] {
  const out: string[] = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll(selector))) {
      out.push((el.textContent || '').trim());
    }
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) walk(sr);
    }
  };
  walk(document);
  return out;
}

/** The FIRST element matching `selector` — checking each root's own (light-DOM)
 *  matches before descending into any child shadow root (document-order-ish,
 *  shadow-piercing) — trimmed `textContent`, or `null` if nothing matches
 *  anywhere. Pass DIRECTLY as a `page.evaluate` callback:
 *  `page.evaluate(deepQuerySelectorFirstTextInPage, selector)`. */
export function deepQuerySelectorFirstTextInPage(selector: string): string | null {
  const find = (root: Document | ShadowRoot): Element | null => {
    const direct = root.querySelector(selector);
    if (direct) return direct;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) {
        const inner = find(sr);
        if (inner) return inner;
      }
    }
    return null;
  };
  const el = find(document);
  return el ? (el.textContent || '').trim() : null;
}

/** The FIRST element matching `selector` (root-first-then-shadow-descend, see
 *  `deepQuerySelectorFirstTextInPage`) — a named attribute off it, or `null`
 *  if nothing matches anywhere OR the element lacks that attribute. Pass
 *  DIRECTLY as a `page.evaluate` callback:
 *  `page.evaluate(deepQuerySelectorFirstAttrInPage, { selector, attr })`. */
export function deepQuerySelectorFirstAttrInPage(args: { selector: string; attr: string }): string | null {
  const { selector, attr } = args;
  const find = (root: Document | ShadowRoot): Element | null => {
    const direct = root.querySelector(selector);
    if (direct) return direct;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) {
        const inner = find(sr);
        if (inner) return inner;
      }
    }
    return null;
  };
  const el = find(document);
  return el ? el.getAttribute(attr) : null;
}

/** What to extract off the deepest active element — see `deepActiveElementProbeInPage`. */
export type DeepActiveElementMode = 'tag' | 'text' | 'placeholder' | 'aria-label' | 'menuitem';

export type DeepActiveElementMenuItemInfo = { role: string | null; disabled: boolean };

/**
 * The deepest REAL `document.activeElement`, recursively piercing open
 * shadow roots (the byte-identical `while (node && node.shadowRoot &&
 * node.shadowRoot.activeElement)` block repeated 3x in command-palette.spec.ts
 * plus the equivalent recursive form in data-table-edit.spec.ts /
 * data-table-grid-rowedit.spec.ts's `focusedTag`), probed for one of a few
 * common shapes callers need. Pass DIRECTLY as a `page.evaluate` callback:
 * `page.evaluate(deepActiveElementProbeInPage, 'text')`.
 */
export function deepActiveElementProbeInPage(
  // Playwright's page.evaluate(fn, arg) overload resolution infers `Arg` from
  // the CALL-SITE string-literal argument as widened `string`, then checks it
  // against `fn`'s declared parameter type — a narrow union parameter type
  // here fails that check even though every call site passes a valid
  // DeepActiveElementMode literal. Keep the param type as `string` (matching
  // deepQuerySelectorAllCount's `selector: string` shape) and narrow inside.
  mode: string,
): string | null | DeepActiveElementMenuItemInfo {
  let node: (Element & { shadowRoot?: ShadowRoot | null }) | null = document.activeElement as Element | null;
  while (node && node.shadowRoot && node.shadowRoot.activeElement) {
    node = node.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
  }
  if (mode === 'menuitem') {
    if (!node) return null;
    return { role: node.getAttribute('role'), disabled: node.getAttribute('aria-disabled') === 'true' };
  }
  if (mode === 'text') return node ? (node.textContent || '').trim() : '';
  if (mode === 'placeholder') return node ? node.getAttribute('placeholder') : null;
  if (mode === 'aria-label') return node ? node.getAttribute('aria-label') : null;
  // mode === 'tag'
  return node ? node.tagName.toLowerCase() : null;
}

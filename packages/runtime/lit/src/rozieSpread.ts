/**
 * rozieSpread — Phase 14 / Plan 14-05 / D-02 / 14-RESEARCH Pattern 4.
 *
 * lit-html element-position `Directive` applying an arbitrary attribute object
 * to its host element. Emitted by `@rozie/target-lit` for every `r-bind="obj"`
 * (and the synthesized `$attrs` auto-fallthrough spread).
 *
 * **Why a directive (not string concat):** Lit has no native attribute-object
 * spread. Building a `${k}=${v}` string per render would forfeit lit-html's
 * cross-render diff — an attribute dropped from the object on a re-render would
 * remain in the DOM (a stale-attribute bug). The element-position
 * `PartType.ELEMENT` directive contract gives us a per-element hook with state
 * (`prevKeys` snapshot) so we can `removeAttribute` keys that disappear between
 * renders — the same pattern `@open-wc/lit-helpers`' `spread()` uses.
 *
 * **Semantics per render:**
 *   1. For each key in `prevKeys` not present in `obj`: `removeAttribute(k)`.
 *   2. For each `[k, v]` in `Object.entries(obj)`:
 *      - `v === null` or `v === false` → `removeAttribute(k)`
 *      - otherwise → `setAttribute(k, String(v))`
 *   3. Snapshot `prevKeys = Object.keys(obj)` for the next render.
 *
 * **Security (T-14-10):** `setAttribute` is the safe DOM API — it does NOT
 * parse HTML and cannot inject markup. The `prevKeys`-diff `removeAttribute`
 * prevents stale-attribute leakage. No `innerHTML` is used.
 *
 * **Position guard:** the constructor enforces `PartType.ELEMENT` — using
 * `rozieSpread(...)` in any other part position (attribute, child, property)
 * throws a descriptive error at template-instantiation time.
 *
 * **Auto-fallthrough target (CONTEXT.md A1 — Lit):** the synthesized `$attrs`
 * `spreadBinding` from Plan 14-02 lands on the template-root element INSIDE
 * the component's shadow tree (the `<button>` the author wrote), NEVER the
 * host custom element. The Lit emitter places the `${rozieSpread(...)}`
 * binding on the inner element it sees in the author's template.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import { noChange } from 'lit';
import { directive, Directive, PartType } from 'lit/directive.js';
import type { ElementPart, PartInfo } from 'lit/directive.js';

/**
 * Per-element `prevKeys` snapshot. Stored OFF the directive instance because
 * lit-html may re-instantiate a directive across renders in some configurations
 * (notably under bundler-resolved mixed dev/prod lit-html where the
 * `parent.__directive` cache isn't reused), and the cross-render diff would
 * silently lose its `prevKeys` snapshot — leaving stale attributes in the DOM.
 * Keying by the host `Element` ensures the snapshot persists across render
 * cycles regardless of directive-instance identity, so the diff stays correct.
 *
 * A `WeakMap` lets the GC reclaim per-element state when the element itself is
 * garbage-collected (e.g. removed from the DOM and no references survive).
 */
const prevKeysByElement = new WeakMap<Element, string[]>();

class RozieSpreadDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'rozieSpread can only be used in element position (e.g. `<button ${rozieSpread(obj)}>`).',
      );
    }
  }

  override update(part: ElementPart, [obj]: [Record<string, unknown>]): symbol {
    const el = part.element as Element;
    const prevKeys = prevKeysByElement.get(el) ?? [];
    // Remove keys that disappeared since the previous render.
    for (const k of prevKeys) {
      if (!(k in obj)) el.removeAttribute(k);
    }
    // Apply current keys: null/false → remove; else → setAttribute(String(v)).
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === false) {
        el.removeAttribute(k);
      } else {
        el.setAttribute(k, String(v));
      }
    }
    prevKeysByElement.set(el, Object.keys(obj));
    return noChange;
  }

  /**
   * The `render(obj)` contract is required by lit-html's `Directive` base, but
   * the element-position directive does its work in `update(part, args)` —
   * `render()`'s return value is unused for element parts. We return `noChange`
   * to signal "no template-tree changes" (the side effect is the DOM mutation
   * performed in `update`).
   */
  render(_obj: Record<string, unknown>): symbol {
    return noChange;
  }
}

export const rozieSpread = directive(RozieSpreadDirective);

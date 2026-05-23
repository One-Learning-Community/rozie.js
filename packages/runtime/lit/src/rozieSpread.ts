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
 *   1. For each key in `prevKeys` not present in `obj`: `removeAttribute(k)`
 *      (except `class`/`style` — those are merge-keys handled below).
 *   2. For each `[k, v]` in `Object.entries(obj)`:
 *      - `k === 'class'` → token-merge (add tokens, additive to template-literal
 *        `class="btn ${this.variant}"`; remove tokens previously added by this
 *        directive that have disappeared from the incoming value).
 *      - `k === 'style'` → per-property merge (parse declaration string, call
 *        `el.style.setProperty(prop, val)`; remove props previously set by this
 *        directive that have disappeared from the incoming value).
 *      - `v === null` or `v === false` → `removeAttribute(k)`.
 *      - otherwise → `setAttribute(k, String(v))`.
 *   3. If `class`/`style` was previously applied but is now absent from `obj`,
 *      remove the previously-applied tokens/props (clean drop semantics).
 *   4. Snapshot `prevKeys = Object.keys(obj)` for the next render.
 *
 * **Phase 14.1 / WR-A1 — R6 class/style always-merge.** Auto-fallthrough lands
 * on the template-root element INSIDE the component's shadow tree (the
 * `<button>` the author wrote). When the template-literal has a static
 * `class="btn ${this.variant}"` and a `style=${styleMap(...)}` BEFORE the
 * `${rozieSpread(this.$attrs)}` binding, lit-html applies each attribute
 * binding in source order, last-write-wins. Routing `class`/`style` through
 * `setAttribute` would CLOBBER the author's class/style entirely (a consumer
 * `class="extra-variant"` would drop `.btn`). Instead, `classList.add` is
 * additive against the prior class-attribute binding, and `style.setProperty`
 * is additive against the prior style-attribute binding. Tracking
 * directive-applied tokens/props in a per-element `WeakMap` lets a consumer-
 * side drop of `class`/`style` cleanly remove the directive's additions
 * without disturbing the wrapper's owned class tokens or style declarations.
 * Mirrors the Angular `__rozieApplyAttrs` merge contract (cross-target parity).
 *
 * **Security (T-14-10):** `setAttribute` is the safe DOM API — it does NOT
 * parse HTML and cannot inject markup. `classList.add` / `style.setProperty`
 * are similarly safe (no HTML parsing). The `prevKeys`-diff `removeAttribute`
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

/**
 * Per-element list of class tokens the directive applied on the prior render.
 * Used to remove ONLY directive-added tokens when the incoming `class` set
 * shrinks — leaves the template-literal's static class tokens untouched.
 */
const prevClassTokensByElement = new WeakMap<Element, string[]>();

/**
 * Per-element list of CSS-property names the directive set via
 * `style.setProperty` on the prior render. Used to remove ONLY directive-set
 * properties when the incoming `style` declaration shrinks — leaves the
 * template-literal's static inline-style declarations untouched.
 */
const prevStylePropsByElement = new WeakMap<Element, string[]>();

function parseClassTokens(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const out: string[] = [];
  for (const tok of value.split(/\s+/)) {
    if (tok.length > 0) out.push(tok);
  }
  return out;
}

function parseStyleDecls(value: unknown): Array<[string, string]> {
  if (typeof value !== 'string') return [];
  const out: Array<[string, string]> = [];
  for (const decl of value.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim();
    const val = decl.slice(colon + 1).trim();
    if (prop.length > 0) out.push([prop, val]);
  }
  return out;
}

function applyClassMerge(el: Element, value: unknown): void {
  const next = parseClassTokens(value);
  const prev = prevClassTokensByElement.get(el) ?? [];
  const nextSet = new Set(next);
  for (const tok of prev) {
    if (!nextSet.has(tok)) el.classList.remove(tok);
  }
  for (const tok of next) el.classList.add(tok);
  prevClassTokensByElement.set(el, next);
}

function applyStyleMerge(el: Element, value: unknown): void {
  const next = parseStyleDecls(value);
  const prev = prevStylePropsByElement.get(el) ?? [];
  const nextProps = next.map(([p]) => p);
  const nextSet = new Set(nextProps);
  const htmlEl = el as HTMLElement;
  for (const prop of prev) {
    if (!nextSet.has(prop)) htmlEl.style.removeProperty(prop);
  }
  for (const [prop, val] of next) htmlEl.style.setProperty(prop, val);
  prevStylePropsByElement.set(el, nextProps);
}

class RozieSpreadDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'rozieSpread can only be used in element position (e.g. `<button ${rozieSpread(obj)}>`).',
      );
    }
  }

  override update(
    part: ElementPart,
    [obj]: [Record<string, unknown> | null | undefined],
  ): symbol {
    const el = part.element as Element;
    // CR-03: a manual `r-bind` whose expression resolves to null/undefined
    // at runtime (e.g. `$data.maybeNull`, an inline `cond ? attrs : null`)
    // previously crashed inside `for (const k of prevKeys) if (!(k in obj))`
    // and `Object.entries(obj)` — both throw on `null`. Coerce nullish to
    // `{}` so the path becomes a clean remove-all-then-no-op, matching the
    // silent-no-op semantics of Vue `v-bind=null`, React `{...null}`, and
    // Svelte `{...null}`.
    const safeObj: Record<string, unknown> = obj ?? {};
    const prevKeys = prevKeysByElement.get(el) ?? [];
    // Remove keys that disappeared since the previous render. `class`/`style`
    // are merge-keys handled separately below — never `removeAttribute` them
    // wholesale (that would wipe the template-literal's static class/style).
    for (const k of prevKeys) {
      if (k === 'class' || k === 'style') continue;
      if (!(k in safeObj)) el.removeAttribute(k);
    }
    // Clean-drop semantics: if `class`/`style` was applied previously but is
    // now absent from the incoming object, remove just the directive's prior
    // additions (the empty-string parse yields an empty next-set, so the
    // diff removes every previously-added token/prop).
    if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
      applyClassMerge(el, '');
    }
    if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
      applyStyleMerge(el, '');
    }
    // Apply current keys.
    for (const [k, v] of Object.entries(safeObj)) {
      if (k === 'class') {
        applyClassMerge(el, v);
      } else if (k === 'style') {
        applyStyleMerge(el, v);
      } else if (v === null || v === false) {
        el.removeAttribute(k);
      } else {
        el.setAttribute(k, String(v));
      }
    }
    prevKeysByElement.set(el, Object.keys(safeObj));
    return noChange;
  }

  /**
   * The `render(obj)` contract is required by lit-html's `Directive` base, but
   * the element-position directive does its work in `update(part, args)` —
   * `render()`'s return value is unused for element parts. We return `noChange`
   * to signal "no template-tree changes" (the side effect is the DOM mutation
   * performed in `update`).
   */
  render(_obj: Record<string, unknown> | null | undefined): symbol {
    return noChange;
  }
}

export const rozieSpread = directive(RozieSpreadDirective);

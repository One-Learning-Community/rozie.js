/**
 * `createRozieAttrApplier` — the `r-bind` / `$attrs` spread attribute-diff
 * factory (Quick task 260819-sg9, Tier 2).
 *
 * Plan 14-05 / D-01 — the SHARED `__rozieApplyAttrs` private class-field
 * diff helper. One per component (deduplicated via `ctx.scriptInjections`).
 * Diffs `prevKeys` between renders so a key dropped from the object is
 * removed from the DOM (T-14-10 stale-attribute prevention).
 *
 * `null` / `false` values trigger `removeAttribute`; everything else routes
 * through `setAttribute(String(v))` — the same contract as the Lit
 * `rozieSpread` directive (cross-target parity).
 *
 * CALLER-INJECTS CONTRACT (Tier 2, 260819-sg9) — this used to be an inlined
 * private-field IIFE that called `inject(Renderer2)` itself
 * (`packages/targets/angular/src/emit/emitTemplateAttribute.ts`,
 * `applyAttrsHelperDecl()`, deleted by this quick task). Moving `inject()`
 * itself across the package boundary would make this package resolve an
 * Angular-core DI token from whichever peer-keyed instance pnpm gave
 * *it*, reopening the same-VERSION-different-INSTANCE hazard behind
 * `71dff1d5`. Instead, the EMITTED component still performs
 * `inject(Renderer2)` in its own field initializer and passes the resolved
 * instance in as `createRozieAttrApplier(inject(Renderer2))` — this module
 * never names an Angular value or type, only the structural
 * `RozieAttrRenderer` interface below, which is what makes the peer-keyed
 * instance split structurally unreachable rather than merely tested
 * against.
 *
 * @public — runtime API consumed by emitted Angular .ts files.
 */

/**
 * The structural subset of `Renderer2` this applier needs. Defined locally
 * (not imported from Angular's core package) so this module names no Angular type
 * — the emitted component's own `Renderer2` instance is assignable to this
 * interface without a cast (proven during planning against the real Angular
 * 19 types: `Renderer2`'s extra optional `namespace?: string | null`
 * parameter and its `el: any` first parameter are both assignable here).
 */
export interface RozieAttrRenderer {
  setAttribute(el: HTMLElement, name: string, value: string): void;
  removeAttribute(el: HTMLElement, name: string): void;
}

/**
 * Build a `(el, obj) => void` applier bound to the caller-supplied renderer.
 *
 * Phase 14.1 / WR-A1 — `class` and `style` are MERGE-keys (R6 always-
 * merge), not REPLACE-keys. The naive `setAttribute(el, 'class', value)`
 * / `setAttribute(el, 'style', value)` path used for all other attrs
 * (a) wipes the wrapper-author's own `class="btn"` / static styles, and
 * (b) loses to Angular's `[ngClass]` / `ɵɵstyleMap` instructions that
 * re-apply on every CD cycle AFTER the effect runs. Handle them via
 * `el.classList.add` (tokenised, additive) and `el.style.setProperty`
 * with `'important'` priority (beats Angular's non-!important styleMap
 * re-apply). Track the tokens/properties we applied per element so a
 * consumer-side drop of `class`/`style` cleanly removes our additions
 * on the next effect run without touching the wrapper's owned classes
 * or styles. Other targets achieve the same "consumer wins" semantic
 * via per-framework merge primitives (React: JSX style-object spread,
 * Vue: mergeProps style merge, Svelte/Solid/Lit: target-native paths).
 */
export function createRozieAttrApplier(
  renderer: RozieAttrRenderer,
): (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => void {
  // Per-element `prevKeys` snapshot keyed by host Element. A single
  // closure-scoped `let prevKeys` (the previous shape) was per-COMPONENT,
  // not per-ELEMENT — two `r-bind` spreads on distinct elements would
  // cross-contaminate the key-removal diff (CR-02). Mirrors the Lit
  // `rozieSpread` directive's `WeakMap<Element, string[]>` pattern.
  //
  // Null/undefined `obj` is coerced to `{}` so a nullable spread expression
  // (`r-bind="$data.maybeNull"`) is a clean removeAll-then-no-op rather
  // than a TypeError on `Object.entries(null)` / `k in null` (CR-04).
  // Matches the silent-no-op contract of Vue `v-bind="null"`, React
  // `{...null}`, and Svelte `{...null}`.
  const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
  const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
  const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
  const parseClassTokens = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    const out: string[] = [];
    for (const tok of value.split(/\s+/)) {
      if (tok.length > 0) out.push(tok);
    }
    return out;
  };
  const parseStyleDecls = (value: unknown): Array<[string, string]> => {
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
  };
  const applyClassMerge = (el: HTMLElement, value: unknown) => {
    const next = parseClassTokens(value);
    const prev = prevClassTokensByElement.get(el) ?? [];
    const nextSet = new Set(next);
    for (const tok of prev) {
      if (!nextSet.has(tok)) el.classList.remove(tok);
    }
    for (const tok of next) el.classList.add(tok);
    prevClassTokensByElement.set(el, next);
  };
  const applyStyleMerge = (el: HTMLElement, value: unknown) => {
    const next = parseStyleDecls(value);
    const prev = prevStylePropsByElement.get(el) ?? [];
    const nextProps = next.map(([p]) => p);
    const nextSet = new Set(nextProps);
    for (const prop of prev) {
      if (!nextSet.has(prop)) el.style.removeProperty(prop);
    }
    for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
    prevStylePropsByElement.set(el, nextProps);
  };
  return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
    const safeObj: Record<string, unknown> = obj ?? {};
    const prevKeys = prevKeysByElement.get(el) ?? [];
    for (const k of prevKeys) {
      if (k === 'class' || k === 'style') continue;
      if (!(k in safeObj)) renderer.removeAttribute(el, k);
    }
    if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
      applyClassMerge(el, '');
    }
    if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
      applyStyleMerge(el, '');
    }
    for (const [k, v] of Object.entries(safeObj)) {
      if (k === 'class') {
        applyClassMerge(el, v);
      } else if (k === 'style') {
        applyStyleMerge(el, v);
      } else if (v === null || v === false) {
        renderer.removeAttribute(el, k);
      } else {
        renderer.setAttribute(el, k, String(v));
      }
    }
    prevKeysByElement.set(el, Object.keys(safeObj));
  };
}

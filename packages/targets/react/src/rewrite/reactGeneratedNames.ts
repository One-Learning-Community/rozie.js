/**
 * reactGeneratedBindingNames — Phase 61 Plan 09 (SC-2 over-application fix,
 * mirrors the Vue `vueGeneratedNames.ts` pattern from Plan 07).
 *
 * Computes the set of SYNTHESIZED-INTERNAL top-level (program/setup-scope)
 * binding names the React emitter ACTUALLY mints for THIS component. A USER
 * `<script>` helper / top-level `const`/`let` equal to one of these genuinely
 * REDECLARES the synthesized binding (broken emit). The renameable side is the
 * USER binding → it auto-renames to `X$local`.
 *
 * CRITICAL — only-on-ACTUAL-generation + program-scope only. Plan 05 seeded the
 * `{ kind: 'binding' }` synthesized-internal group with a STATIC set
 * (`props`/`attrs`/`_props`/`_rozieExposeRef`/`portals`/`prev`) and NO
 * `programOnly` gate. That over-applied to legal NESTED shadows — a
 * function-local `const prev = live.datasets.slice()` (chartjs reconcile helper)
 * or a parameter `(attrs) => …` / `function isActive(name, attrs)` (tiptap) is
 * NOT a redeclare; it lexically shadows the React updater param / fallthrough
 * spread correctly. The static set + unconditional binding trigger renamed all
 * of them (`prev → prev$local` ×35, `attrs → attrs$local` ×4, `props →
 * props$local` ×2), drifting the committed `@rozie-ui` React leaves.
 *
 * TWO precise gates (identical to the Vue 61-07 fix):
 *   1. `programOnly: true` on the group → ONLY a PROGRAM/setup-scope binding is
 *      renamed; a function param / function-local is a legal nested shadow,
 *      never touched.
 *   2. This helper → each name gated on the IR condition that makes the emitter
 *      mint it at program scope. `prev` is EXCLUDED ENTIRELY — React never emits
 *      a TOP-LEVEL `prev`; it exists only as the `setX(prev => …)` functional-
 *      updater PARAMETER (always nested), so a top-level `const prev` can never
 *      collide. (Same rationale as Vue excluding `h`/`render`/`Fragment`.)
 *
 * Generation conditions mirror emitScript.ts / emitReact.ts / shell.ts exactly:
 *   - `props`           ⟺ ALWAYS (the component function parameter / defaults
 *                          rebind const — every React component has it).
 *   - `_props`          ⟺ any non-model prop declares a default
 *                          (`defaultedNonModelProps.length > 0`) — shell names
 *                          the param `_props` and rebinds `const props`.
 *   - `attrs`           ⟺ inherit-attrs OR inherit-listeners is on, OR the
 *                          template spreads `$attrs`/`$listeners` (the `const
 *                          attrs = …` / IIFE fallthrough object). The cheap IR
 *                          flags are a SUPERSET of the template-spread cases, so
 *                          gating on them alone is conservative-correct (it can
 *                          only OVER-include `attrs`, never miss a real
 *                          collision — and `attrs` defaults to emitted).
 *   - `_rozieExposeRef` ⟺ `ir.expose.length > 0` (the `$expose` handle-stash useRef).
 *   - `portals`         ⟺ any portal slot (the portal closure injected in the
 *                          mount hook).
 *   - `prev`            ⟺ NEVER (updater param only — excluded entirely).
 *
 * Returns the `Set<string>` of names that WOULD redeclare a program-scope
 * synthesized binding for this component. Defensive `?? []` reads throughout so
 * hand-rolled partial test IRs do not throw.
 */
import type { IRComponent } from '@rozie/core';

export function reactGeneratedBindingNames(ir: IRComponent): Set<string> {
  const out = new Set<string>();

  // `props` — the component function parameter is always present.
  out.add('props');

  // `_props` — the param is renamed to `_props` (and `const props` rebound) when
  // a non-model prop declares a default.
  const props = ir.props ?? [];
  const defaultedNonModelProps = props.filter((p) => !p.isModel && p.defaultValue !== null);
  if (defaultedNonModelProps.length > 0) out.add('_props');

  // `attrs` — the fallthrough spread object. Emitted when inherit-attrs or
  // inherit-listeners is on (the default), OR the template spreads
  // `$attrs`/`$listeners`. The IR flags are a superset of the template-spread
  // cases (both default to TRUE → `attrs` emitted), so gating on the flags is
  // conservative-correct.
  if (ir.inheritAttrs !== false || ir.inheritListeners !== false) {
    out.add('attrs');
  }

  // `_rozieExposeRef` — the `$expose` handle-stash useRef.
  if ((ir.expose ?? []).length > 0) out.add('_rozieExposeRef');

  // `portals` — the portal-slot closure injected in the mount hook.
  const hasPortalSlots = (ir.slots ?? []).some((s) => s.isPortal === true);
  if (hasPortalSlots) out.add('portals');

  // `prev` — DELIBERATELY NOT added. React emits no top-level `prev`; it is only
  // ever the `setX(prev => …)` updater parameter (always nested). Including it
  // over-applied to the chartjs `const prev = live.datasets.slice()` helper local.

  return out;
}

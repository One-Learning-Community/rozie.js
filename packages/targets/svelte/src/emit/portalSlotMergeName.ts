/**
 * portalSlotMergeName — Svelte-target slot-merge identifier disambiguation.
 *
 * The Svelte emitter destructures each slot prop to a temp (`header:
 * __headerProp`) and declares a top-level `$derived` merge that prefers the
 * statically-named consumer fill over the dynamic-name `snippets` map entry:
 *
 *   const header = $derived(__headerProp ?? snippets?.header);
 *
 * The script-side `$slots.header` reads (slot-presence gates, `if ($slots.X)`)
 * and the `$portals` closure's `snippet:`/guard references all resolve to this
 * bare `header` identifier.
 *
 * When a component ALSO declares a `<props>` entry named `header`, the props
 * destructure already binds `header` (`let { header = false } = $props()`), so
 * the `$derived` merge `const header = ...` is a SECOND declaration of the same
 * identifier in the same `<script>` scope — a hard Svelte compile error
 * (`Identifier 'header' has already been declared`). This was only caught by the
 * whole-repo VR build because the Svelte leaf package ships source with no real
 * build/typecheck step.
 *
 * COLLISION-GATED: to keep existing non-colliding Svelte fixtures byte-identical,
 * we suffix the slot-merge identifier with `Slot` ONLY when the bare slot name
 * collides with a declared prop name. Non-colliding slots keep their bare-name
 * `$derived` merge.
 *
 * The collision is producer-internal (entirely within one component's
 * `<script>`), so — unlike Lit's `producerPropCollision` thread — no
 * consumer-side wiring is needed.
 *
 * This helper is the SINGLE source of truth for the merge identifier; it MUST be
 * used at every site that references it:
 *   - emitScript.ts (emitSlotDerivedMerges) — the `const <name> = $derived(...)` decl
 *   - emitPortals.ts (buildSlotMethod)       — the `if (!<name>)` guard + `snippet: <name>`
 *   - rewriteScript.ts                       — the `$slots.<name>` → `<name>` rewrite
 *   - rewriteTemplateExpression.ts           — the same `$slots.<name>` rewrite (template/listeners)
 *
 * NOTE: the `$portals` closure object KEY stays the BARE slot name — the
 * script-side `$portals.<name>(...)` call is rewritten to `portals.<name>(...)`,
 * so the key must match the slot name regardless of the merge-identifier suffix.
 * Only the *reads* of the merged callback use this (possibly suffixed) name.
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

/**
 * Return the Svelte top-level identifier for a slot's `$derived` merge.
 *
 * The DEFAULT slot (`''`) maps to the `children` snippet (Svelte 5's built-in
 * default-slot magic prop) — Phase 37 ($portals.default) reads the default
 * portal slot's content from this `children` identifier. Named slots suffix with
 * `Slot` iff the bare slot name collides with a declared `<props>` entry;
 * otherwise the bare name.
 */
export function portalSlotMergeName(slotKey: string, ir: IRComponent): string {
  // The default slot maps to `children`, which can never collide with a prop
  // (a prop named `children` would be its own pre-existing collision surface
  // outside this concern). Phase 37: a default PORTAL slot reads `children`.
  if (slotKey === '' || slotKey === 'children') return 'children';
  const collides = (ir.props ?? []).some((p) => p.name === slotKey);
  return collides ? slotKey + 'Slot' : slotKey;
}

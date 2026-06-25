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
import * as t from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';

/**
 * Phase 61 Plan 08 — the WIDENED collision set for the slot-merge `Slot` suffix
 * (collision-svelte §3 risk 4: computed == slot). The Svelte `$derived` slot-
 * merge `const <slot> = $derived(...)` shares the single `<script>` scope with
 * EVERY top-level binding — not just `<props>` (the pre-Plan-08 trigger), but
 * also `<data>` (`let X = $state()`), `$computed` (`const X = $derived()`), and
 * residual `<script>` helpers (`const X = …`). A same-named binding makes the
 * slot-merge `const <slot>` a DUPLICATE declaration → hard Svelte "already
 * declared". Suffixing the merge ident `Slot` dodges it. Computed/data are part
 * of `ir`; helpers come from the residual `<script>` Program top level.
 */
function widenedMergeCollisionNames(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  for (const p of ir.props ?? []) names.add(p.name);
  for (const s of ir.state ?? []) names.add(s.name);
  for (const c of ir.computed ?? []) names.add(c.name);
  // Residual <script> top-level helper bindings (consts/lets/functions). The
  // computed declarators are already included via ir.computed; re-adding their
  // names here is harmless (a Set).
  const program = ir.setupBody?.scriptProgram;
  if (program) {
    for (const stmt of program.program.body) {
      if (t.isVariableDeclaration(stmt)) {
        for (const decl of stmt.declarations) {
          if (t.isIdentifier(decl.id)) names.add(decl.id.name);
        }
      } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
        names.add(stmt.id.name);
      }
    }
  }
  return names;
}

/**
 * Return the Svelte top-level identifier for a slot's `$derived` merge.
 *
 * The DEFAULT slot (`''`) maps to the `children` snippet (Svelte 5's built-in
 * default-slot magic prop) — Phase 37 ($portals.default) reads the default
 * portal slot's content from this `children` identifier. Named slots suffix with
 * `Slot` iff the bare slot name collides with a declared `<props>` / `<data>` /
 * `$computed` / `<script>`-helper binding (Plan 08 widened the trigger from the
 * original props-only set — collision-svelte §3 risk 4); otherwise the bare name.
 */
export function portalSlotMergeName(slotKey: string, ir: IRComponent): string {
  // The default slot maps to `children`, which can never collide with a prop
  // (a prop named `children` would be its own pre-existing collision surface
  // outside this concern). Phase 37: a default PORTAL slot reads `children`.
  if (slotKey === '' || slotKey === 'children') return 'children';
  const collides = widenedMergeCollisionNames(ir).has(slotKey);
  return collides ? slotKey + 'Slot' : slotKey;
}

/**
 * typed-surface-barrel.mjs — the ONE shared helper every
 * `packages/ui/<family>/scripts/codegen.mjs` uses to append the typed public
 * surface (typed-surface P1) to a leaf's package-entry barrel (`src/index.ts`).
 *
 * WHY: the emitted component module exports the public TYPES (`<types>` names,
 * the typed `$expose` handle, Lit's `Rozie<Name>EventMap`), but a barrel that
 * only forwards the component's default export hides them from consumers who
 * import the package entry. Each family used to hand-roll its own subset, which
 * let targets drift (Vue lacked the handle, Lit lacked the event map). One
 * helper, keyed on the IR, keeps every family + target in lockstep.
 *
 * What it appends (nothing for a component that declares none of it, so a
 * family that does not opt in keeps its barrel byte-identical):
 *   - vue:   `export type * from './<C>.vue';` when the SFC has a module
 *            `<script lang="ts">` — i.e. `<types>` names or `$expose`
 *            signatures (the typed `<C>Handle` lives there).
 *   - lit:   `export type { Rozie<C>EventMap } from './<C>';` when `<emits>`
 *            is declared (the element itself is the handle), plus
 *            `export type * from './<C>';` for `<types>` names.
 *   - react / solid: `export type * from './<C>';` for `<types>` names (the
 *            handle line stays in the family codegen, which already emits it).
 *   - angular: nothing — its hand-committed barrel is `export * from './<C>'`.
 *   - svelte: nothing — the package entry IS the component module.
 *
 * Pure glue over the `@rozie/core` public IR.
 */

/**
 * @param {'react'|'vue'|'svelte'|'angular'|'solid'|'lit'} target
 * @param {{ name: string, types?: { exportedNames: string[] } | null, expose?: Array<{ signature?: unknown }>, emitDecls: unknown[] | null }} ir
 * @param {string} componentName
 * @returns {string} extra barrel lines ('' when the component declares no typed surface)
 */
export function typedSurfaceBarrelLines(target, ir, componentName) {
  const hasTypes = Boolean(ir.types?.exportedNames.length);
  const hasSignatures = (ir.expose ?? []).some((e) => e.signature !== undefined);
  const lines = [];
  if (target === 'vue') {
    if (hasTypes || hasSignatures) lines.push(`export type * from './${componentName}.vue';`);
  } else if (target === 'react' || target === 'solid' || target === 'lit') {
    if (target === 'lit' && ir.emitDecls !== null) {
      lines.push(`export type { Rozie${ir.name}EventMap } from './${componentName}';`);
    }
    if (hasTypes) lines.push(`export type * from './${componentName}';`);
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

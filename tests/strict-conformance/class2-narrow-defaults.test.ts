/**
 * CLASS-2/5 WITNESS — narrow `<data>`/signal defaults (`[]`→never[], `{}`→
 * implicit-any index, `null`→Signal<null>) and the Class-5 fallout (null/never
 * iterable into `For`/`repeat`).
 *
 * Phase 65 (Bundle C / Item 2), SC-2 + SC-5. RED-FIRST: a DEDICATED minimal
 * `.rozie` fixture is compiled to react/solid/lit and strict-typechecked. A
 * dedicated fixture (vs a committed leaf) keeps the witness FREE of the
 * body-passthrough noise (Class 4 `const foCache = { x: null }`, body-const
 * `const next = {}`) that contaminates a real leaf's narrow-default counts — the
 * fixture has ONLY narrow `<data>` defaults, so after the fix the emitted output
 * is fully strict-clean (total errors === 0 per target).
 *
 * The fixture exercises three narrow shapes + the Class-5 iterable:
 *   - `rows: []`   → `.map`/`For`/`repeat` over it   (Class 2 never[] + Class 5)
 *   - `bag: {}`    → indexed by a string key          (Class 2 TS7053)
 *   - `marker: null` → assigned an object             (Class 2 TS2322 → 'null')
 *
 * ── RED-FIRST ANCHOR (observed 2026-06-29, strict flags on, pre-fix) ──────────
 * React  emits `useState<any[]>([])` + `useState<any>(null)` ALREADY (Phase
 *        16/quick-260520 array+null widening) — its sole residual narrow shape
 *        is `useState({})` → `bag[k]` TS7053. (1 error)
 * Solid  emits bare `createSignal([])`/`({})`/`(null)` → `rows().map` TS2349,
 *        `bag()[k]` TS7053, `setMarker({…})` TS2322 'null', `For each={rows()}`
 *        TS2769. (multiple)
 * Lit    emits bare `signal([])`/`({})`/`(null)` → `.value.map` / `.value[k]`
 *        TS7053 / `.value = {…}` TS2322 'null' / `repeat(this._rows.value …)`
 *        TS2769. (multiple)
 * After the Solid `createSignal<T>` / React `useState<T>` (`{}` case) / Lit
 * `signal<T>` narrow-literal type-arg carve-out lands: total === 0 on all three.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from 'vitest';
import { typecheckCompiled, totalErrors, type Target } from './strict-conformance.harness.js';
import { compile } from '@rozie/core';

/** Minimal fixture: ONLY narrow `<data>` defaults + the Class-5 iterable. */
const FIXTURE = `<rozie name="NarrowDefaults">
<data>
{
  // Class 2 — empty-array default infers never[]
  rows: [],
  // Class 2 — empty-object default infers {} (implicit-any index)
  bag: {},
  // Class 2 — bare-null default infers null
  marker: null,
}
</data>
<script lang="ts">
// Class 2 (never[]): .map over the empty-array <data>
function rowIds() {
  return $data.rows.map((r: any) => r.id)
}
// Class 2 (TS7053): index the empty-object <data> by a string key
function lookup(k: string) {
  return $data.bag[k]
}
// Class 2 (null): assign an object to the null-default <data>
function setMark() {
  $data.marker = { x: 1, y: 2 }
}
function clearMark() {
  $data.marker = null
}
</script>
<template>
  <div>
    <button type="button" @click="setMark()">mark</button>
    <button type="button" @click="clearMark()">clear</button>
    <span>{{ lookup('k') }}</span>
    <span>{{ rowIds().length }}</span>
    <ul>
      <li r-for="row in $data.rows" :key="row.id">{{ row.label }}</li>
    </ul>
  </div>
</template>
</rozie>
`;

/** A committed per-target leaf whose node_modules carries the right peer deps. */
const NM_FROM: Record<Target, string> = {
  react: 'packages/ui/combobox/packages/react',
  solid: 'packages/ui/combobox/packages/solid',
  lit: 'packages/ui/combobox/packages/lit',
};

const EXT: Record<Target, string> = { react: 'tsx', solid: 'tsx', lit: 'ts' };

describe('CLASS-2/5 — narrow `<data>`/signal defaults are widened (SC-2 + SC-5)', () => {
  for (const target of ['react', 'solid', 'lit'] as Target[]) {
    it(`${target}: dedicated narrow-default fixture is strict-clean (no Class-2/5)`, () => {
      const result = compile(FIXTURE, {
        target,
        filename: 'NarrowDefaults.rozie',
        sourceMap: false,
      });
      const diagErrors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(diagErrors, `[${target}] fixture must compile clean`).toEqual([]);

      const { raw, inventory } = typecheckCompiled({
        target,
        files: { [`NarrowDefaults.${EXT[target]}`]: result.code },
        nodeModulesFrom: NM_FROM[target],
      });

      const total = totalErrors(inventory);
      expect(
        total,
        `[${target}] expected 0 strict errors over the narrow-default fixture ` +
          `(GREEN). Got ${total}. RED pre-fix is expected; GREEN required after the ` +
          `narrow-literal signal/state type-arg carve-out (Solid createSignal<T> / ` +
          `React useState<T> {} case / Lit signal<T>) lands.\n--- tsc output ---\n` +
          raw,
      ).toBe(0);
    });
  }
});

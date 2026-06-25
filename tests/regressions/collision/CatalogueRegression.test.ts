/**
 * Phase 61 Plan 09 (SC-4) — Cross-target name-collision CATALOGUE regression suite.
 *
 * The goal-backward closure of Phase 61: every collision class that was
 * discovered ONE-BY-ONE across the prior port findings (catalogued in memory
 * `project_pure_rozie_collision_classes_2026_06` + the six `collision-*.md`
 * NEW-risk sections) now has ONE permanent assertion proving the systemic fix
 * catches it PROACTIVELY — either:
 *
 *   - INTERNAL tier (Half A, auto-rename): the colliding INTERNAL name
 *     (`<data>`/`$computed`/`$inject`-local / `<script>` helper / `$refs` /
 *     module-let) is auto-renamed to `X$local` (or the per-target
 *     `XSlot`/`X$$slot` shape) and the emitted code compiles clean. The author
 *     never sees the collision.
 *
 *   - PUBLIC-CONTRACT tier (Half B, lint): the colliding PUBLIC name
 *     (`<props>` key / emit / slot / `$expose` verb) — which Half A CANNOT
 *     rename without breaking the consumer API — surfaces the exact ROZ
 *     diagnostic (ROZ142 / ROZ137 / ROZ127) with the right severity + a
 *     did-you-mean hint.
 *
 * Each test name maps to its catalogue CLASS + the affected TARGET(s) so a
 * future reader can trace coverage. Per-target Half-A plans (61-02..61-08)
 * already shipped their own emitter-level fixtures (referenced in each
 * SUMMARY); this suite is the consolidated cross-target net, driving the public
 * `compile()` API with minimal inline sources (no repo fixtures added — an
 * error-fixture in the corpus would break unrelated gates).
 *
 * Discipline (D-08 collected-not-thrown): every assertion drives `compile()` and
 * inspects `code` + `diagnostics`; no throw path is exercised.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';

type Target = 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit';
const ALL_TARGETS: Target[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

/** Compile a source to one target; return code + diagnostics (never throws). */
function emit(source: string, target: Target) {
  return compile(source, {
    target,
    filename: 'CatalogueRegression.rozie',
    types: true,
    sourceMap: false,
  });
}

/** Error-severity diagnostics for a compile result. */
function errorsOf(result: ReturnType<typeof emit>) {
  return result.diagnostics.filter((d) => d.severity === 'error');
}

/** Find a diagnostic by ROZ code (any severity). */
function diagByCode(result: ReturnType<typeof emit>, code: string) {
  return result.diagnostics.find((d) => String(d.code) === code);
}

// ──────────────────────────────────────────────────────────────────────────
// INTERNAL tier — auto-rename to X$local, clean compile.
// ──────────────────────────────────────────────────────────────────────────

describe('Catalogue / INTERNAL (auto-rename) — Half A', () => {
  // Class: Vue generated-binding shadow (collision-vue §3) — a <data> field named
  // a generated <script setup> binding (`slots`/`emit`) auto-renames.
  it('Vue: <data> named a generated binding (`slots`) → renamed $local, clean', () => {
    // A `$slots.footer` READ in script forces the generated `const slots =
    // useSlots()` binding to exist (the collision condition); the `<data> slots`
    // field then collides with it (TS2451 redeclare) pre-fix.
    const src = `<rozie name="VueGenBindingShadow">
<data>
{ slots: 0 }
</data>
<script>
$onMount(() => { if ($slots.footer) { $data.slots = 1 } })
</script>
<template>
  <div>{{ $data.slots }}<slot name="footer">f</slot></div>
</template>
</rozie>`;
    const result = emit(src, 'vue');
    expect(errorsOf(result)).toEqual([]);
    // The user <data> binding is renamed; the generated `const slots = useSlots()`
    // keeps the bare name (no TS2451 redeclare).
    expect(result.code).toContain('slots$local');
    expect(result.code).toContain('useSlots()');
  });

  // Class: React declare-then-assign ref shadow (collision-react §3 risk A) — a
  // module-let colliding with a `$refs` name renames to X$local (no TS2451).
  it('React: declare-then-assign ref shadow → module-let renamed $local, one ref-const', () => {
    const src = `<rozie name="ReactRefShadow">
<script>
let anchorEl = null
$onMount(() => { anchorEl = $refs.anchorEl })
</script>
<template>
  <div ref="anchorEl">x</div>
</template>
</rozie>`;
    const result = emit(src, 'react');
    expect(errorsOf(result)).toEqual([]);
    expect(result.code).toContain('anchorEl$local');
    // Exactly one `const anchorEl = useRef` (the ref-const is the contract).
    const refConsts = result.code.match(/const anchorEl = useRef/g) ?? [];
    expect(refConsts).toHaveLength(1);
  });

  // Class: React synthesized-internal cross-kind shadow (collision-react §2 +
  // Plan 09 over-application fix) — a TOP-LEVEL helper named `attrs` renames; a
  // NESTED param/local of the same name stays bare.
  it('React: top-level `const attrs` renames $local but a nested `prev` local stays bare', () => {
    const src = `<rozie name="ReactSynthShadow">
<data>
{ total: 0 }
</data>
<script>
const attrs = { role: 'group' }
const reconcile = (rows) => {
  const prev = rows.slice()
  return prev.length
}
const x = reconcile([])
</script>
<template>
  <div>{{ $data.total }}{{ x }}</div>
</template>
</rozie>`;
    const result = emit(src, 'react');
    expect(errorsOf(result)).toEqual([]);
    // Genuine top-level redeclare of the synthesized `const attrs = props as …`.
    expect(result.code).toContain('attrs$local');
    // Plan 09 over-application guard: the nested helper-local `prev` is a LEGAL
    // shadow of the `setX(prev => …)` updater param → NOT renamed.
    expect(result.code).not.toContain('prev$local');
    expect(result.code).toContain('const prev = rows.slice()');
  });

  // Class: Solid <data>/$computed ungrouped (collision-solid NEW risks) — a
  // <data> key colliding with an $expose verb is renamed at the IR level
  // uniformly (the `open` listbox footgun) — clean on Solid.
  it('Solid: <data> key == $expose verb → state key renamed $local, exposed verb intact', () => {
    const src = `<rozie name="SolidExposeShadow">
<data>
{ open: false }
</data>
<script>
const toggle = () => { $data.open = !$data.open }
$expose({ open: toggle })
</script>
<template>
  <button @click="toggle">{{ $data.open }}</button>
</template>
</rozie>`;
    const result = emit(src, 'solid');
    expect(errorsOf(result)).toEqual([]);
    // The internal state key is renamed; the public exposed `open` verb stays.
    expect(result.code).toContain('open$local');
  });

  // Class: Lit $computed-name == reserved class member (collision-lit R-NEW-1) —
  // a `$computed` named a reserved member auto-renames at the IR level.
  it('Lit: $computed named a reserved member (`title`) → renamed $local, clean', () => {
    const src = `<rozie name="LitComputedShadow">
<props>
{ first: { type: String, default: 'a' } }
</props>
<script>
const title = $computed(() => $props.first + '!')
</script>
<template>
  <div>{{ title }}</div>
</template>
</rozie>`;
    const result = emit(src, 'lit');
    expect(errorsOf(result)).toEqual([]);
    // `title` (an inherited HTMLElement member) is renamed on the Lit class.
    expect(result.code).toContain('title$local');
  });

  // Class: Svelte runtime-only (collision-svelte) — a loop var named a helper /
  // a slot param shadow is auto-renamed at the Svelte emit walk. We assert clean
  // compile across the off-collision corpus shape (no error diagnostics) — the
  // Svelte emitter's loop-shadow rename keeps the output valid.
  it('Svelte: loop-var == helper name → clean compile (runtime-only auto-rename)', () => {
    const src = `<rozie name="SvelteLoopShadow">
<data>
{ items: [1, 2, 3] }
</data>
<script>
const item = (n) => n * 2
</script>
<template>
  <ul>
    <li r-for="item in $data.items">{{ item }}</li>
  </ul>
</template>
</rozie>`;
    const result = emit(src, 'svelte');
    expect(errorsOf(result)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PUBLIC-CONTRACT tier — lint with the exact ROZ code (Half B).
// ──────────────────────────────────────────────────────────────────────────

describe('Catalogue / PUBLIC-CONTRACT (lint) — Half B', () => {
  // Class: prop == SILENT reserved (Vue strips `key`/`ref`/`is`; React swallows
  // `key`/`ref`/`children`) → ROZ142 ERROR (no typecheck catches it).
  it('Vue/React: a <props> key `key` (SILENT-stripped reserved) → ROZ142 error + did-you-mean', () => {
    const src = `<rozie name="PropKeyCollision">
<props>
{ key: { type: String, default: '' } }
</props>
<template>
  <div>{{ $props.key }}</div>
</template>
</rozie>`;
    // The lint is target-agnostic (core semantic pass) — fires on any target.
    const result = emit(src, 'vue');
    const roz142 = diagByCode(result, 'ROZ142');
    expect(roz142).toBeDefined();
    expect(roz142!.severity).toBe('error');
    // Did-you-mean nudges toward `${name}Base`.
    expect(roz142!.hint ?? '').toContain('Base');
  });

  // Class: $expose verb == reserved class member (Lit lifecycle `update` /
  // Angular CVA / Object.prototype) → widened ROZ137 warning.
  it('Lit/Angular: $expose verb `update` (Lit lifecycle) → ROZ137 warning', () => {
    const src = `<rozie name="ExposeLifecycleCollision">
<script>
const update = () => {}
$expose({ update })
</script>
<template>
  <div>x</div>
</template>
</rozie>`;
    const result = emit(src, 'lit');
    const roz137 = diagByCode(result, 'ROZ137');
    expect(roz137).toBeDefined();
    expect(roz137!.severity).toBe('warning');
  });

  // Class: scoped slot == inherited DOM member (Lit bare @property accessor) →
  // generalized ROZ127 error. (A PLAIN named slot of the same name is NOT a
  // collision — Plan 09 gate — covered in validateSlotPropCollision.test.ts.)
  it('Lit: a SCOPED slot `title` (bare @property accessor) → ROZ127 error', () => {
    const src = `<rozie name="ScopedSlotTitleCollision">
<template>
  <div>
    <slot name="title" :params="['row']">t</slot>
  </div>
</template>
</rozie>`;
    const result = emit(src, 'lit');
    const roz127 = diagByCode(result, 'ROZ127');
    expect(roz127).toBeDefined();
    expect(roz127!.severity).toBe('error');
    expect(roz127!.message).toContain('title');
  });

  // Class: slot == prop (the original Phase 28 ROZ127) → error on all targets
  // (Svelte 5 unifies snippets+props into one namespace).
  it('all targets: slot name == <props> key → ROZ127 error (Svelte-5 namespace clash)', () => {
    const src = `<rozie name="SlotPropCollision">
<props>
{ panel: { type: Boolean, default: false } }
</props>
<template>
  <div><slot name="panel">p</slot></div>
</template>
</rozie>`;
    for (const target of ALL_TARGETS) {
      const result = emit(src, target);
      const roz127 = diagByCode(result, 'ROZ127');
      expect(roz127, `ROZ127 expected on ${target}`).toBeDefined();
      expect(roz127!.severity).toBe('error');
    }
  });
});

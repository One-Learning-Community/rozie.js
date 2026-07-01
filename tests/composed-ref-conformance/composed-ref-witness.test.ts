/**
 * COMPOSED-REF WITNESS — red-first 6-target gate (Phase 66, D-4).
 *
 * A `<components>`-composed child referenced via `$refs.child` types as
 * `HTMLElement` on react/vue/svelte/solid/lit, so the exposed-method call
 * `$refs.child.ping()` is a TS2339 ("property 'ping' does not exist on type
 * 'HTMLElement'"). Angular alone types the ref as the child instance → clean.
 *
 * This suite OBSERVES (never assumes) the pre-fix typing by compiling the
 * ComposedRefParent + ExposeChild fixtures to each target and running that
 * target's REAL checker (tsc / vue-tsc / svelte-check). The 5 broken-target
 * assertions are `it.fails` NOW — they assert the DESIRED end state
 * (`pingHtmlElementCount === 0`) which currently FAILS (RED), so `.fails`
 * inverts to green and the suite is committable RED-documented. When the P2-P4
 * emitter fixes land, each target flips to a real green: the `.fails` test then
 * passes unexpectedly, forcing that plan's executor to drop `.fails` and convert
 * it to a plain green `it`. Angular is a plain green `it` NOW (SC-3 regression
 * cover). A fixture that passes pre-fix proves nothing
 * (memory feedback_snapshot_tests_cement_bugs) — hence the observed anchors.
 *
 * ── RED-FIRST ANCHOR (observed 2026-07-01, pre-fix, real per-target checkers) ──
 * React   ComposedRefParent.tsx(14,30): error TS2339: Property 'ping' does not
 *           exist on type 'HTMLElement'.
 *         (ref: `const child = useRef<HTMLElement | null>(null)` → `child.current!.ping()`)
 * Solid   ComposedRefParent.tsx(14,24): error TS2339: Property 'ping' does not
 *           exist on type 'HTMLElement'.
 *         (ref: `let childRef: HTMLElement | null = null` → `childRef.ping()`)
 * Lit     ComposedRefParent.ts(20,41): error TS2339: Property 'ping' does not
 *           exist on type 'HTMLElement'.
 *         (ref: `@query(...) private _refChild!: HTMLElement` → `this._refChild.ping()`)
 * Vue     ComposedRefParent.vue(22,34): error TS2339: Property 'ping' does not
 *           exist on type 'HTMLElement'.
 *         (ref: `const childRef = ref<HTMLElement>()` → `childRef.value!.ping()`)
 * Svelte  Error: Property 'ping' does not exist on type 'HTMLElement'. (ts)
 *         (svelte-check human format, no "TS2339" token;
 *          ref: `let child = $state<HTMLElement | undefined>(undefined)` → `child!.ping()`)
 * Angular clean — `child = viewChild<ExposeChild>('child')` → `this.child()!.ping()`
 *           resolves the re-emitted public `ping(): string` class member.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from 'vitest';
import { runWitness, type Target } from './composed-ref.harness.js';

/** All six compile targets — used by the compile-without-crash smoke test. */
const ALL_TARGETS: Target[] = ['react', 'solid', 'vue', 'svelte', 'lit', 'angular'];

// NOTE: there is no longer a BROKEN_TARGETS list. lit was the final RED target
// and is now fixed via the D-2 element-class route (FIXED_ELEMENT_CLASS_TARGETS
// below). react+solid (P2, Handle-INTERFACE) and vue+svelte (P3, component-
// INSTANCE) were fixed earlier. The full witness now has NO `.fails`-gated
// target: 7/7 green.

/**
 * Targets FIXED by P2 (the Handle-INTERFACE route): a composed-component ref
 * types as the child's exported `<Name>Handle`, so `$refs.child.ping()`
 * typechecks and the "ping does not exist on HTMLElement" count is 0. Plain
 * GREEN `it` (no `.fails`).
 */
const FIXED_HANDLE_TARGETS: Target[] = ['react', 'solid'];

/**
 * Targets FIXED by P3 (the component-INSTANCE route, D-2): a composed-component
 * ref types as the child component INSTANCE — Vue `ref<InstanceType<typeof
 * Child>>()`, Svelte-5 `bind:this` component instance — whose surface carries the
 * exposed members. NO `<Name>Handle` import, NO `codegen.mjs` change.
 * `$refs.child.ping()` typechecks, so the "ping does not exist on HTMLElement"
 * count is 0. Plain GREEN `it` (no `.fails`).
 */
const FIXED_INSTANCE_TARGETS: Target[] = ['vue', 'svelte'];

/**
 * Targets FIXED by P4 (the ELEMENT-CLASS route, D-2 Lit branch): a composed-
 * component ref types as the child ELEMENT CLASS — Lit re-emits the child's
 * `$expose` verbs as PUBLIC members on `class Child extends LitElement` and the
 * sidecar `.d.rozie.ts` declares `export declare class Child` +
 * `HTMLElementTagNameMap['rozie-child'] = Child`, so the `@query` ref field typed
 * as `Child` resolves the exposed member without a shadow-pierce. The parent
 * imports the child class by name (`import type { Child } from '<child>'`). NO
 * `<Name>Handle` interface (Lit's handle IS the element class), NO `codegen.mjs`
 * change. `$refs.child.ping()` typechecks, so the "ping does not exist on
 * HTMLElement" count is 0. Plain GREEN `it` (no `.fails`).
 */
const FIXED_ELEMENT_CLASS_TARGETS: Target[] = ['lit'];

describe('composed-component ref → Handle typing witness (D-4)', () => {
  it('both fixtures compile to all 6 targets without a compiler crash', () => {
    for (const t of ALL_TARGETS) {
      // runWitness compiles ExposeChild + ComposedRefParent and throws on a
      // compiler-error diagnostic; reaching a checker result means both compiled.
      expect(() => runWitness(t)).not.toThrow();
    }
  }, 180000);

  it('angular: composed-component ref typechecks clean (SC-3 regression cover)', () => {
    const r = runWitness('angular');
    expect(
      r.pingHtmlElementCount,
      `[angular] expected 0 "ping does not exist on HTMLElement" errors (GREEN — the ` +
        `ref is typed viewChild<ExposeChild>). Got ${r.pingHtmlElementCount}.\n${r.raw}`,
    ).toBe(0);
  }, 180000);

  // GREEN (P2 fix landed): react/solid type the composed ref as the child's
  // exported `<Name>Handle` — `$refs.child.ping()` typechecks, so the "ping on
  // HTMLElement" count is 0. Plain `it` (the `.fails` gate is dropped the moment
  // the fix makes the assertion pass for real — per the it.fails design above).
  for (const target of FIXED_HANDLE_TARGETS) {
    it(
      `${target}: composed ref types as child handle, not HTMLElement (GREEN — P2 fix)`,
      () => {
        const r = runWitness(target);
        expect(
          r.pingHtmlElementCount,
          `[${target}] expected 0 "ping does not exist on HTMLElement" errors ` +
            `(GREEN — the ref is typed as the child <Name>Handle). ` +
            `Got ${r.pingHtmlElementCount}.\n${r.raw}`,
        ).toBe(0);
      },
      180000,
    );
  }

  // GREEN (P3 fix landed): vue/svelte type the composed ref as the child
  // component INSTANCE (Vue `ref<InstanceType<typeof Child>>()`, Svelte-5
  // `bind:this` instance) — `$refs.child.ping()` typechecks, so the "ping on
  // HTMLElement" count is 0. NO Handle import, NO codegen.mjs change (D-2).
  for (const target of FIXED_INSTANCE_TARGETS) {
    it(
      `${target}: composed ref types as child component instance, not HTMLElement (GREEN — P3 fix)`,
      () => {
        const r = runWitness(target);
        expect(
          r.pingHtmlElementCount,
          `[${target}] expected 0 "ping does not exist on HTMLElement" errors ` +
            `(GREEN — the ref is typed as the child component instance). ` +
            `Got ${r.pingHtmlElementCount}.\n${r.raw}`,
        ).toBe(0);
      },
      180000,
    );
  }

  // GREEN (P4 fix landed): lit types the composed ref as the child ELEMENT CLASS
  // (`@query(...) private _refChild!: ExposeChild`), importing the child class by
  // name. `$refs.child.ping()` typechecks, so the "ping on HTMLElement" count is
  // 0. This target's checker output must ALSO be fully clean (zero `error TS`):
  // the element-class route resolves the child's `.rozie` type import to the real
  // declared class, so any residual error (e.g. TS2709 "cannot use namespace as a
  // type", or TS2304 "cannot find name") would be a real regression the narrow
  // ping/HTMLElement counter cannot see. Plain GREEN `it` (no `.fails`).
  for (const target of FIXED_ELEMENT_CLASS_TARGETS) {
    it(
      `${target}: composed ref types as child element class, not HTMLElement (GREEN — P4 fix)`,
      () => {
        const r = runWitness(target);
        expect(
          r.pingHtmlElementCount,
          `[${target}] expected 0 "ping does not exist on HTMLElement" errors ` +
            `(GREEN — the ref is typed as the child element class). ` +
            `Got ${r.pingHtmlElementCount}.\n${r.raw}`,
        ).toBe(0);
        const errorLines = r.raw
          .split('\n')
          .filter((l) => /error TS\d+/.test(l))
          .map((l) => l.trim());
        expect(
          errorLines,
          `[${target}] expected a fully clean typecheck (the element-class type ` +
            `resolves the exposed member); got:\n${errorLines.join('\n')}`,
        ).toEqual([]);
      },
      180000,
    );
  }
});

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

/** The 5 targets that currently mis-type a composed-component ref as HTMLElement. */
const BROKEN_TARGETS: Target[] = ['react', 'vue', 'svelte', 'solid', 'lit'];

describe('composed-component ref → Handle typing witness (D-4)', () => {
  it('both fixtures compile to all 6 targets without a compiler crash', () => {
    for (const t of [...BROKEN_TARGETS, 'angular'] as Target[]) {
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

  // RED-FIRST: each broken target asserts the DESIRED end state (count === 0),
  // which currently FAILS (count >= 1). `it.fails` inverts → committable green.
  // P2-P4 emitter fixes flip these to a real pass, forcing removal of `.fails`.
  for (const target of BROKEN_TARGETS) {
    it.fails(
      `${target}: composed ref should type as child handle, not HTMLElement (RED pre-fix)`,
      () => {
        const r = runWitness(target);
        // Emit the observed anchor to the raw log (bypasses vitest console
        // interception) so the red-first gate can grep the real, observed error
        // text — never assumed. `it.fails` still inverts the failing assertion
        // below to a committable green while the RED persists.
        const anchor =
          r.raw
            .split('\n')
            .find((l) => /Property 'ping' does not exist on type 'HTMLElement'/.test(l))
            ?.trim() ?? '(no ping/HTMLElement line captured)';
        process.stdout.write(`\n[RED-WITNESS ${target}] ${anchor}\n`);
        expect(r.pingHtmlElementCount).toBe(0);
      },
      180000,
    );
  }
});

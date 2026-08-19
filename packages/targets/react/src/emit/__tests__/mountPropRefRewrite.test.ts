/**
 * Quick 260803-swj SEAM 2 RED — a `props.<X>` read inside a `$onMount`-created
 * closure is frozen at the first-render value forever on React.
 *
 * Ref synthesis is gated on exactly two discovery sets (`emitScript.ts`):
 *   - `watchedNonModelPropNames` (:1826-1835) — props that are a `$watch`
 *     getter dep, matched as `props.<X>` MemberExpressions;
 *   - `mountReactiveStateNames` (:1865-1867) — `ir.state` + model props,
 *     matched as bare Identifiers, and only for `lh.phase === 'mount'`.
 *
 * `findRefsInBody`'s MemberExpression visitor (:1904-1911) closes over
 * `watchedNonModelPropNames` DIRECTLY — it takes a `bareNames` parameter for
 * the identifier flavour but has no equivalent parameter for the member
 * flavour. And a mount hook always emits `depsArr = '[]'` (:2764-2765, "Bug B
 * fix 260519 linechart-watch-recreate"), so any closure created inside it
 * freezes every non-ref `props.X` read at first render.
 *
 * The pathology this fixture pins: in ONE mount closure, two declared props
 * read identically behave differently — a prop that HAPPENS to also be a
 * `$watch` source is live (`_gainRef.current`), its neighbour is dead
 * (`props.pannable`). Live on the other five targets, dead on React.
 *
 * Concrete pre-existing instance at HEAD:
 * `packages/ui/rete/packages/react/src/FlowCanvas.tsx` — the minimap
 * pointer-pan handlers stashed in refs at mount (:2725, :2737) each guard on
 * `props.pannable`; `_readonlyRef` exists in the same file only because
 * `readonly` happens to be a `$watch` source.
 *
 * Harness copied from `attrNameMap.test.ts`.
 *
 * ---
 *
 * Quick 260804-f0f SEAM 3 — the `$emit` flavour of the identical seam, and the
 * fourth/final sibling of the `bcc1149c` / `9acd7737` staleness family.
 *
 * swj (above) deliberately fenced `props.on<Event>` reads OUT of the discovery
 * set, pending a naming-collision question, and pinned that fence with
 * `GREEN GUARD-4 (D-04)`. f0f measured the question closed and retired the
 * fence: `ir.emits`-derived handler names are now unioned into
 * `mountReadablePropNames` alongside `ir.props`, so `$emit('x')` inside a
 * `$onMount` closure reads through `_onXRef.current` instead of freezing the
 * first-render handler forever. GUARD-4 is inverted IN PLACE as `RED-4 (D-01)`
 * rather than deleted, so the audit trail from fence → evidence → retirement
 * survives in one file. `RED-5 / GUARD-5 (D-02)` adds the phase gate: one
 * component with `$emit` in BOTH `$onMount` and `$onUpdate`, proving the mount
 * half is indirected and the update half is untouched.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

interface EmittedEffect {
  /** The callback body, between `useEffect(() => {` and its matching `}`. */
  body: string;
  /** The dep-array source text, e.g. `[]` or `[props.live, touch]`. */
  deps: string;
}

/**
 * Paren-match every `useEffect(...)` call in the emitted module and split each
 * into (callback body, dep array) so a mount-phase assertion can never be
 * satisfied by an `$onUpdate` or watcher effect.
 */
function extractEffects(emitted: string): EmittedEffect[] {
  const out: EmittedEffect[] = [];
  for (const m of emitted.matchAll(/useEffect\(/g)) {
    const start = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let i = start;
    while (i < emitted.length && depth > 0) {
      const ch = emitted[i]!;
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      if (depth === 0) break;
      i++;
    }
    const call = emitted.slice(start, i);
    const depMatch = /,\s*(\[[\s\S]*\])\s*$/.exec(call);
    if (!depMatch) continue;
    out.push({
      body: call.slice(0, depMatch.index),
      deps: depMatch[1]!,
    });
  }
  return out;
}

function mountEffect(emitted: string): EmittedEffect {
  const mounts = extractEffects(emitted).filter((e) => e.deps === '[]');
  if (mounts.length !== 1) {
    throw new Error(`expected exactly one []-dep effect, got ${mounts.length}:\n${emitted}`);
  }
  return mounts[0]!;
}

describe('emitScript (React) — $onMount-scoped prop reads must go through synced refs (Quick 260803-swj seam 2)', () => {
  // ONE component, several probes at once. `gain` is BOTH a declared prop and a
  // `$watch` source (so it already gets a ref today); `pannable` is its
  // neighbour in the SAME closure and today is not; `live` is read from an
  // `$onUpdate` hook and must stay untouched.
  const SRC = `<rozie name="Test" inherit-attrs="false">
<props>{ pannable: { type: Boolean, default: true }, gain: { type: Number, default: 1 }, live: { type: Boolean, default: false } }</props>
<emits>{ ping: null }</emits>
<data>{ handler: null }</data>
<script>
$onMount(() => {
  const h = () => { if (!$props.pannable) return; use($props.gain); $emit('ping'); };
  document.addEventListener('pointerdown', h);
  return () => document.removeEventListener('pointerdown', h);
});
$onUpdate(() => { touch($props.live); });
$watch(() => $props.gain, (v) => { note(v); });
</script>
<template><div>hi</div></template>
</rozie>`;

  it('synthesises a synced ref for a declared prop read inside the mount closure', () => {
    const code = compile(SRC);

    // RED-1 — ref synthesis. `pannable` is a declared, non-model prop read
    // inside a mount-phase lifecycle body, so it must get the SAME
    // `_<X>Ref` treatment a `$watch` source gets.
    expect(code).toContain('const _pannableRef = useRef(props.pannable);');
    expect(code).toContain('_pannableRef.current = props.pannable;');

    // RED-2 — read rewrite inside the `[]`-dep effect's nested closure.
    const mount = mountEffect(code);
    expect(mount.body).toContain('_pannableRef.current');
    expect(mount.body).not.toContain('props.pannable');

    // RED-3 — a prop that is ALSO a `$watch` source must not be
    // double-declared. Green today too; this locks the Set semantics of the
    // ref-decl union so a future refactor cannot emit a duplicate
    // `const _gainRef` (TS2451).
    const gainDecls = code.match(/const _gainRef = useRef\(/g) ?? [];
    expect(gainDecls).toHaveLength(1);
    expect(mount.body).toContain('_gainRef.current');
  });

  it('GREEN GUARD-1 (D-05) — an $onUpdate hook keeps raw reads AND its dep array', () => {
    const code = compile(SRC);
    const update = extractEffects(code).find((e) => e.deps.includes('props.live'));
    expect(update, 'expected an $onUpdate effect depending on props.live').toBeDefined();
    // The update hook re-creates its closures when the dep changes, so there is
    // no staleness to defend against — the read stays raw and the dep stays.
    expect(update!.body).toContain('props.live');
    expect(update!.body).not.toContain('_liveRef');
    // No ref is minted for an update-only prop. Widening the component-wide
    // `actuallyRewrittenNonModelProps` set instead of adding a mount-scoped one
    // would strip `props.live` from this dep array — a behaviour regression.
    expect(code).not.toContain('_liveRef');
  });

  it('GREEN GUARD-2 (D-07) — $watch lowering is structurally unchanged', () => {
    const code = compile(SRC);
    // `rewriteWatchedPropReads` is only ever invoked on `ir.lifecycle` bodies;
    // watcher bodies go through the separate `watcherPairing` path and are NOT
    // in this walk. This seam adds ref MIRRORING for reads inside `$onMount`
    // and creates no watcher. Assert the watcher effect explicitly so a future
    // widening of this seam into watcher bodies fails loudly.
    const watcher = extractEffects(code).find((e) => e.body.includes('_watch0First'));
    expect(watcher, 'expected the $watch effect').toBeDefined();
    // Still deps on the tracked read path (lazy — not `{ immediate: true }`).
    expect(watcher!.deps).toBe('[props.gain]');
    // Still carries its first-run guard.
    expect(watcher!.body).toContain(
      'if (_watch0First.current) { _watch0First.current = false; return; }',
    );
    // The watcher body reads the prop DIRECTLY, not through the ref.
    expect(watcher!.body).toContain('const v = props.gain;');
  });

  it('GREEN GUARD-3 — the mount effect dep array is still []', () => {
    const code = compile(SRC);
    // A mount hook runs exactly once by contract on all six targets; React
    // honours that only via an empty dep array (Bug B fix 260519).
    expect(() => mountEffect(compile(SRC))).not.toThrow();
    expect(mountEffect(code).deps).toBe('[]');
  });

  it('RED-4 (D-01) — $emit handlers are mirrored too', () => {
    const code = compile(SRC);
    const mount = mountEffect(code);
    // Quick 260804-f0f. This assertion was `GREEN GUARD-4 (D-04)` — the fence
    // swj put up while the naming-collision question was open. Inverted in
    // place (not deleted) so the audit trail survives. The evidence that
    // retired the fence:
    //
    //   - SHAPE: `$emit('x', …)` lowers to `props.onX && props.onX(…)`
    //     (`rewriteScript.ts:1365-1381`) — a LogicalExpression over TWO plain
    //     `props.<X>` MemberExpressions, i.e. precisely what `findRefsInBody`'s
    //     MemberExpression visitor already matches and `rewriteWatchedPropReads`
    //     already rewrites. 184/184 corpus reads are `LOGICAL_AND_left` or
    //     `CALLEE`; zero are optional-call or value-position, so the blocker
    //     that killed w7b's value-position helper seam is structurally absent.
    //   - COLLISION: `_on<Pascal>Ref` is prefix-disjoint from the portal
    //     `_render<Pascal>Ref` family by construction, and disjoint from
    //     `actuallyRewrittenModelProps`, which mints BARE-name refs (`_valueRef`)
    //     and never an `on<X>Change` consumer field. Measured corpus
    //     collisions: 0. A declared prop that happens to be NAMED `on<X>` is
    //     already in this set from the `ir.props` loop and the `Set` dedupes it
    //     to exactly one decl (same semantics RED-3 pins for `_gainRef`).
    //   - STALENESS: 184/184 corpus reads sit in a DEFERRED closure; none is a
    //     synchronous top-level statement of the effect body. Every rewrite is
    //     a real fix, not a byte churn.
    expect(code).toContain('const _onPingRef = useRef(props.onPing);');
    expect(code).toContain('_onPingRef.current = props.onPing;');
    expect(mount.body).toContain('_onPingRef.current && _onPingRef.current();');
    expect(mount.body).not.toContain('props.onPing');
  });

  // Quick 260804-f0f D-02 — the phase gate, in ONE component so the two halves
  // cannot drift apart: `$emit('ping')` inside a deferred closure in `$onMount`
  // (must be indirected — the hook emits `[]` deps and freezes the handler),
  // and `$emit('tick')` directly in `$onUpdate` (must stay RAW — that hook keeps
  // a real dep array, so React re-creates its closures on dep change and there
  // is no staleness to defend against). Same construction FlowCanvas gave w7b.
  //
  // This source is also the live probe that settled the dep-filter question:
  // `onTick` is NOT in `[props.live, touch]`, because `setupDeps` is built from
  // `$props.` sigil reads in the SOURCE (`core/src/reactivity/buildDepGraph.ts`)
  // and `$emit('tick')` is a CallExpression on `$emit`, not a `$props` read. So
  // `filteredSetupDeps` needs no new disjunct — unlike swj's and w7b's seams.
  const SRC_EMIT_PHASE = `<rozie name="Test" inherit-attrs="false">
<props>{ live: { type: Boolean, default: false } }</props>
<emits>{ ping: null, tick: null }</emits>
<script>
$onMount(() => {
  const h = () => { $emit('ping'); };
  document.addEventListener('x', h);
});
$onUpdate(() => {
  touch($props.live);
  $emit('tick');
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('RED-5 / GUARD-5 (D-02) — $emit is mirrored in $onMount and left raw in $onUpdate', () => {
    const code = compile(SRC_EMIT_PHASE);

    // RED-5 — the mount half. Red pre-fix.
    expect(code).toContain('const _onPingRef = useRef(props.onPing);');
    expect(code).toContain('_onPingRef.current = props.onPing;');
    const mount = mountEffect(code);
    expect(mount.body).toContain('_onPingRef.current && _onPingRef.current();');
    expect(mount.body).not.toContain('props.onPing');

    // GUARD-5 — the update half. Green pre-fix AND post-fix. The union lands in
    // `mountReadablePropNames`, which `memberNamesForHook` gates on
    // `lh.phase === 'mount'`, so an `$onUpdate` hook is byte-unchanged.
    const update = extractEffects(code).find((e) => e.deps.includes('props.live'));
    expect(update, 'expected an $onUpdate effect depending on props.live').toBeDefined();
    expect(update!.body).toContain('props.onTick && props.onTick();');
    expect(code).not.toContain('_onTickRef');
  });

  // Quick 260803-swj seam 2, follow-up — a lifecycle hook whose SETUP body has
  // a discovered read but whose CLEANUP body has NONE. Discovery is per-HOOK
  // but the rewrite must be per-BODY: rebuilding a function node that contains
  // zero rewritten reads is a pure no-op that only destroys bytes, because
  // `t.arrowFunctionExpression(...)` reconstruction drops comments attached to
  // the block.
  //
  // Caught by the SearchInput fixture (`fixtures/SearchInput.tsx.snap`), whose
  // mount cleanup contains ONLY a comment: before this gate the widened
  // discovery set pulled that hook into the rewrite path for the first time and
  // silently replaced the comment with whitespace. The cleanup block here is
  // deliberately comment-ONLY, matching that shape exactly — a comment attached
  // to a sibling STATEMENT rides along with the cloned statement and would not
  // reproduce the defect.
  const SRC_CLEANUP_COMMENT = `<rozie name="Test" inherit-attrs="false">
<props>{ pannable: { type: Boolean, default: true } }</props>
<script>
$onMount(() => {
  const h = () => { if (!$props.pannable) return; };
  document.addEventListener('pointerdown', h);
  return () => {
    // teardown note: this comment must survive the mount-ref rewrite
  };
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('leaves a zero-rewrite cleanup body byte-identical (comment preserved)', () => {
    const code = compile(SRC_CLEANUP_COMMENT);

    // The SETUP body still gets the rewrite — this guards against over-narrowing
    // the gate into "skip the whole hook".
    expect(code).toContain('const _pannableRef = useRef(props.pannable);');
    expect(code).toContain('_pannableRef.current');

    // The CLEANUP body has zero discovered reads, so its AST node must not be
    // rebuilt at all, and its comment must survive verbatim.
    expect(code).toContain('// teardown note: this comment must survive the mount-ref rewrite');
  });

  it('emitted module snapshot', () => {
    expect(compile(SRC)).toMatchSnapshot();
  });

  it('emitted module snapshot — zero-rewrite cleanup body', () => {
    expect(compile(SRC_CLEANUP_COMMENT)).toMatchSnapshot();
  });
});

/**
 * Quick 260803-w7b SEAM 3 RED — a top-level `<script>` helper CALLED from
 * inside a `$onMount`-created closure is frozen at the first-render instance
 * forever on React.
 *
 * React lowers a top-level helper that reads reactive scope into
 * `const H = useCallback(fn, [deps])` (`emitScript.ts` —
 * `tryWrapEscapingHelperUseCallback`, :418-518). That identity is refreshed on
 * every render, which is correct for render-scope callers and for
 * `$watch` / listener dep arrays. But a `$onMount` hook lowers to a `[]`-dep
 * `useEffect` BY CONTRACT (the `depsArr` ternary, :2891-2892, "Bug B fix
 * 260519 linechart-watch-recreate"), so a closure created INSIDE it captures
 * the FIRST render's `H` and calls it forever. `H` closes over the first
 * render's `props` / state, so every value it returns is frozen at mount time.
 *
 * Seam 2 (`bcc1149c`) fixed the DIRECT flavour — a `props.X` read written
 * literally inside the mount body now goes through `_XRef.current`. Its pass 4b
 * (:2007-2174) rewrites `props.<X>` MemberExpressions and bare reactive
 * Identifiers, but has NO concept of a CallExpression whose callee is a
 * top-level helper. This is the INDIRECT flavour: the same read, one call hop
 * away, inside a helper.
 *
 * Concrete pre-existing instance at HEAD=cfe22157:
 * `packages/ui/rete/packages/react/src/FlowCanvas.tsx` —
 *   :399  `const currentGraph = useCallback(() => graph || {...}, [graph]);`
 *   :2785 `const redrawMinimap = () => {`   (declared INSIDE the `[]`-dep
 *         mount effect that spans :1304 → :3642)
 *   :2797 `const graphNodes = currentGraph().nodes || [];`
 * The closure captured the first render's `currentGraph`, whose `graph` was the
 * mount-time value — an EMPTY graph for a mount-seeded consumer. Recorded by
 * the VR cell `tests/visual-regression/specs/rete-flow.spec.ts:3630-3656`
 * (`rete-flow-large [react]`, `.rozie-flow-minimap__node` stuck at 0 while the
 * other five targets report 48).
 *
 * The same file also proves the defect is PHASE-specific: `currentGraph()` at
 * :3653 sits in a `}, [graph]` effect, which re-creates its closure on every
 * `graph` change and is therefore already live. D-05 keeps it byte-identical.
 *
 * Harness (`compile` / `extractEffects` / `mountEffect`) copied verbatim from
 * `mountPropRefRewrite.test.ts:31-88`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
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

/**
 * Count BARE invocations of `name` — i.e. `name(` not preceded by a `.`, a word
 * char or a `$`. `_<name>Ref.current(` therefore never counts: the `name` inside
 * `_nameRef` is preceded by `_` (a word char) and followed by `Ref`, not `(`.
 */
function bareCallCount(src: string, name: string): number {
  const re = new RegExp(String.raw`(?<![.\w$])${name}\s*\(`, 'g');
  return [...src.matchAll(re)].length;
}

describe('emitScript (React) — $onMount-scoped helper CALLS must go through synced refs (Quick 260803-w7b seam 3)', () => {
  // ONE component, several probes at once.
  //   `readGain`  — reads reactive scope → `useCallback(fn, [props.gain])` →
  //                 unstable identity → ELIGIBLE (D-02).
  //   `constant`  — reads nothing reactive → `useCallback(fn, [])` → identity
  //                 stable by construction → NOT eligible (D-02).
  // The mount body calls `readGain` from a NESTED closure (the real defect) and
  // `constant` at the top level of the effect (byte churn only, D-06). The
  // `$onUpdate` hook and the `$watch` effect both call `readGain` and must stay
  // untouched (D-05), as must the render-scope JSX call (D-01's rejected
  // Option B).
  const SRC_MAIN = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 }, live: { type: Boolean, default: false } }</props>
<script>
const readGain = () => $props.gain * 2;
const constant = () => 42;
$onMount(() => {
  const h = () => { use(readGain()); };
  document.addEventListener('pointerdown', h);
  seed(constant());
  return () => document.removeEventListener('pointerdown', h);
});
$onUpdate(() => { touch($props.live); use(readGain()); });
$watch(() => readGain(), (v) => { note(v); });
</script>
<template><div>{{ readGain() }}</div></template>
</rozie>`;

  it('RED — routes a mount-scoped helper call through a synced ref declared after the helper', () => {
    const code = compile(SRC_MAIN);

    // RED-1 — ref synthesis. `readGain` has a NON-EMPTY `useCallback` dep array,
    // so its identity is refreshed every render while the `[]`-dep mount closure
    // holds render #1's instance forever.
    expect(code).toContain('const _readGainRef = useRef(readGain);');
    expect(code).toContain('_readGainRef.current = readGain;');

    // RED-2 — call rewrite inside the nested mount closure. This is the only
    // assertion that actually changes runtime behaviour.
    const mount = mountEffect(code);
    expect(mount.body).toContain('_readGainRef.current(');
    expect(bareCallCount(mount.body, 'readGain')).toBe(0);

    // RED-3 — PLACEMENT. `emitReact.ts:229` joins
    // `[hookSection, userArrowsSection, lifecycleEffectsSection]` IN THAT ORDER,
    // so a `useRef(readGain)` emitted into `hookSection` (where seam 2's
    // `_XRef` decls live) would reference a `const … = useCallback(…)` still in
    // its temporal dead zone — a render-time ReferenceError that no string
    // assertion would otherwise catch. The ref decl must land AFTER the helper.
    const helperAt = code.indexOf('const readGain = useCallback(');
    const refAt = code.indexOf('const _readGainRef = useRef(readGain);');
    expect(helperAt).toBeGreaterThan(-1);
    expect(refAt).toBeGreaterThan(helperAt);
  });

  it('GREEN GUARD-1 (D-02) — a helper with an EMPTY dep array is left alone', () => {
    const code = compile(SRC_MAIN);
    const mount = mountEffect(code);
    // `constant` is `useCallback(() => 42, [])`: React never mints a new
    // instance, so the mount closure's captured instance IS the current one.
    // No staleness ⇒ no ref ⇒ the call site stays byte-identical.
    expect(code).toContain('const constant = useCallback(() => 42, []);');
    expect(code).not.toContain('_constantRef');
    expect(bareCallCount(mount.body, 'constant')).toBe(1);
  });

  it('GREEN GUARD-2 (D-05) — $onUpdate and $watch bodies keep bare calls and real deps', () => {
    const code = compile(SRC_MAIN);
    const effects = extractEffects(code);

    // $onUpdate keeps its real dep array, so React re-creates its closures when
    // a dep changes — there is no staleness to defend against. Verified live at
    // `FlowCanvas.tsx:3653`, where the same `currentGraph()` call sits in the
    // `[graph]`-dep effect and is already correct.
    const update = effects.find((e) => e.deps.includes('props.live'));
    expect(update, 'expected an $onUpdate effect depending on props.live').toBeDefined();
    expect(bareCallCount(update!.body, 'readGain')).toBe(1);
    expect(update!.body).not.toContain('_readGainRef');
    expect(update!.deps).toBe('[props.live, readGain, touch, use]');

    // Watcher bodies are not in this walk at all (they go through
    // `watcherPairing`), preserving $watch lazy semantics x6.
    const watcher = effects.find((e) => e.body.includes('_watch0First'));
    expect(watcher, 'expected the $watch effect').toBeDefined();
    expect(bareCallCount(watcher!.body, 'readGain')).toBe(1);
    expect(watcher!.body).not.toContain('_readGainRef');
    expect(watcher!.deps).toBe('[readGain]');
  });

  it('GREEN GUARD-3 — the mount effect dep array is still []', () => {
    const code = compile(SRC_MAIN);
    // A mount hook runs exactly once by contract on all six targets; React
    // honours that only via an empty dep array (Bug B fix 260519). The fix is a
    // REF, never a dep — that is the whole point of D-01.
    expect(mountEffect(code).deps).toBe('[]');
  });

  it('GREEN GUARD-4 — render scope and the helper are byte-unchanged', () => {
    const code = compile(SRC_MAIN);
    // The returned JSX still calls the helper BARE. Render scope re-runs every
    // render, so it already sees the current instance; indirecting it would be
    // pure byte churn.
    expect(code).toContain('{rozieDisplay(readGain())}');
    // The helper's OWN dep array is asserted as a literal so a future widening
    // into helper-BODY rewriting (the Option B rejected in D-01, which would
    // collapse this to `[]` and freeze the $watch/listener effects that carry
    // `readGain` in their deps) fails loudly here.
    expect(code).toContain('const readGain = useCallback(() => props.gain * 2, [props.gain]);');
  });

  it('snapshot — SRC_MAIN', () => {
    expect(compile(SRC_MAIN)).toMatchSnapshot();
  });

  // --- D-03 — CALL positions only ------------------------------------------
  // `document.addEventListener('x', H)` inside a mount body registers the FIRST
  // render's `H` — the same defect — but the only fix is a wrapper
  // `(...a) => _HRef.current(...a)`, which mints a NEW function identity and so
  // breaks the matching `removeEventListener(H)` in the cleanup. Rewriting the
  // bare identifier to `_HRef.current` would be WORSE than doing nothing (it
  // snapshots the current instance at registration time while adding bytes).
  // Filed to the emitter-hardening backlog; pinned here as byte-identical.
  const SRC_VALUE_POS = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick = () => { use($props.gain); };
$onMount(() => {
  document.addEventListener('pointerdown', onTick);
  return () => document.removeEventListener('pointerdown', onTick);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  // GREEN GUARD-5 (D-03) originally pinned VALUE-position helper references
  // as byte-identical — the only fix available at seam-3 time (an inline
  // `(...a) => _HRef.current(...a)` at EACH call site) would mint a NEW
  // function identity per call site and break the paired
  // `removeEventListener(onTick)`, so seam 3 deliberately left this shape
  // untouched and filed it (`react-value-position-helper-stale-mount-refs`).
  //
  // Quick 260806-w00 seam 4 closes that backlog item: ONE stable wrapper is
  // hoisted per (helper, hook) and BOTH the registration and the
  // de-registration are rewritten to reference it, which is what keeps the
  // pairing intact. This guard's premise (byte-identical) is dead; inverted
  // here to its post-fix assertion, with a companion assertion for what the
  // OLD guard was actually protecting — identity pairing between the
  // registration and the de-registration.
  it('INVERTED (was GREEN GUARD-5, D-03) — a VALUE-position helper reference now routes through a stable wrapper (Quick 260806-w00 seam 4)', () => {
    const code = compile(SRC_VALUE_POS);
    const mount = mountEffect(code);
    // Eligible by D-02 (`useCallback(fn, [props.gain])`); previously never
    // CALLED, and previously never wrapped either. Now wrapped.
    expect(code).toContain('const onTick = useCallback(');
    expect(code).toContain('const _onTickRef = useRef(onTick);');
    expect(code).toContain(
      'const _onTickStable: typeof _onTickRef.current = (...args) => _onTickRef.current(...args);',
    );
    expect(mount.body).not.toContain("document.addEventListener('pointerdown', onTick)");
    expect(mount.body).toContain("document.addEventListener('pointerdown', _onTickStable)");
    expect(mount.body).toContain("document.removeEventListener('pointerdown', _onTickStable)");
  });

  it('companion (D-04 pairing) — the registration and de-registration resolve to the SAME wrapper identifier', () => {
    // This is the actual correctness property the old GUARD-5 was protecting
    // against regressing: whatever identity `addEventListener` registers,
    // `removeEventListener` must de-register the SAME identity, or the
    // listener leaks for the app's lifetime (T-w00-01).
    const code = compile(SRC_VALUE_POS);
    const mount = mountEffect(code);
    const registerMatch = /document\.addEventListener\('pointerdown', (\w+)\)/.exec(mount.body);
    const unregisterMatch = /document\.removeEventListener\('pointerdown', (\w+)\)/.exec(mount.body);
    expect(registerMatch?.[1]).toBeDefined();
    expect(registerMatch?.[1]).toBe(unregisterMatch?.[1]);
    // And exactly ONE wrapper declaration exists — not one per call site.
    const declCount = (code.match(/const _onTickStable:/g) ?? []).length;
    expect(declCount).toBe(1);
  });

  // Re-blessed by Quick 260806-w00 (seam 4) — the snapshot now captures the
  // stable-wrapper shape (`_onTickRef` + `_onTickStable`) instead of the
  // byte-identical bare-`onTick` shape seam 3 froze. See the INVERTED test
  // above for the assertion-level explanation.
  it('snapshot — SRC_VALUE_POS', () => {
    expect(compile(SRC_VALUE_POS)).toMatchSnapshot();
  });

  // --- D-12 — the swj option-2 per-BODY rebuild gate ------------------------
  // Discovery is per-HOOK (a helper called from either body needs its ref
  // declared once) but each function-node REBUILD must stay gated on its OWN
  // body having at least one rewrite: `t.arrowFunctionExpression(...)`
  // reconstruction drops comments attached to the block. This reproduces the
  // exact shape of swj's S2 (`SearchInput`) for the NEW discovery set — the
  // cleanup block is deliberately comment-ONLY (a comment attached to a sibling
  // STATEMENT rides along with the cloned statement and would not reproduce it).
  const SRC_CLEANUP_COMMENT = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const readGain = () => $props.gain * 2;
$onMount(() => {
  const h = () => { use(readGain()); };
  document.addEventListener('pointerdown', h);
  return () => {
    // teardown note: this comment must survive the mount-helper rewrite
  };
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('RED — rewrites the setup body while a zero-rewrite cleanup keeps its comment (D-12)', () => {
    const code = compile(SRC_CLEANUP_COMMENT);
    const mount = mountEffect(code);

    // The SETUP body gets the rewrite — guards against over-narrowing the gate
    // into "skip the whole hook".
    expect(code).toContain('const _readGainRef = useRef(readGain);');
    expect(mount.body).toContain('_readGainRef.current(');
    expect(bareCallCount(mount.body, 'readGain')).toBe(0);

    // ...and the comment-ONLY cleanup body survives verbatim.
    expect(mount.body).toContain(
      '// teardown note: this comment must survive the mount-helper rewrite',
    );
  });

  it('snapshot — SRC_CLEANUP_COMMENT', () => {
    expect(compile(SRC_CLEANUP_COMMENT)).toMatchSnapshot();
  });

  // --- D-11 — shadow guard --------------------------------------------------
  // A mount body may declare a LOCAL binding with the same name as a top-level
  // helper. Because the rewrite traverses a synthetic Program built from the
  // body, a locally-declared name HAS a binding in that scope while a real
  // top-level helper does NOT — so `path.scope.getBinding(name)` is a correct,
  // machinery-free shadow test.
  const SRC_SHADOW = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const readGain = () => $props.gain * 2;
$onMount(() => {
  const readGain = () => 7;
  seed(readGain());
});
</script>
<template><div>{{ readGain() }}</div></template>
</rozie>`;

  it('GREEN GUARD-6 (D-11) — a locally-shadowed name keeps its bare invocation', () => {
    const code = compile(SRC_SHADOW);
    const mount = mountEffect(code);
    // The top-level `readGain` IS eligible (its body reads `props.gain`), but
    // the call inside the mount body resolves to the LOCAL const, which is a
    // different function entirely. Rewriting it would change behaviour.
    expect(mount.body).toContain('const readGain = () => 7;');
    expect(bareCallCount(mount.body, 'readGain')).toBe(1);
    expect(code).not.toContain('_readGainRef');
  });

  it('snapshot — SRC_SHADOW', () => {
    expect(compile(SRC_SHADOW)).toMatchSnapshot();
  });

  // --- D-10 — collision guard ----------------------------------------------
  // Both this path and seam 2 / 5c-bis / `emitPortals` mint `_<name>Ref`. A
  // top-level helper named after a DECLARED PROP that is also read in the mount
  // body would emit a duplicate `const _fooRef` (TS2451). No family in the
  // corpus trips this today (T0-d probe: 0 collisions across 58 files / 1151
  // helpers / 743 existing `useRef` bindings); the guard ships regardless and
  // this case pins it.
  const SRC_COLLIDE = `<rozie name="Test" inherit-attrs="false">
<props>{ foo: { type: Number, default: 1 }, bar: { type: Number, default: 2 } }</props>
<script>
const foo = () => $props.bar * 2;
$onMount(() => {
  const h = () => { use(foo()); use($props.foo); };
  document.addEventListener('pointerdown', h);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('GREEN GUARD-7 (D-10) — a helper whose ref ident would collide is skipped', () => {
    const code = compile(SRC_COLLIDE);
    const mount = mountEffect(code);
    // Exactly ONE `_fooRef` — seam 2's, for the PROP `foo`. The helper `foo` is
    // skipped so seam 2's prop-ref semantics are untouched (TS2451 tripwire).
    const fooRefDecls = code.match(/const _fooRef = useRef\(/g) ?? [];
    expect(fooRefDecls).toHaveLength(1);
    expect(code).toContain('const _fooRef = useRef(props.foo);');
    // The prop read IS rewritten (seam 2), the helper call is NOT (D-10).
    expect(mount.body).toContain('use(_fooRef.current)');
    expect(bareCallCount(mount.body, 'foo')).toBe(1);
  });

  it('snapshot — SRC_COLLIDE', () => {
    expect(compile(SRC_COLLIDE)).toMatchSnapshot();
  });

  // Review follow-up (260804) — the eligibility gate deliberately does NOT
  // exclude `function` declarations (unlike `useCallbackHelperNames`): a
  // function declaration in component scope is re-created per render exactly
  // like an arrow helper, so the same staleness argument applies. This case
  // pins that generalization, which the arrow-only fixtures above left
  // unexercised.
  const SRC_FUNCDECL = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
function readScale() { return $props.gain * 3; }
$onMount(() => {
  const h = () => { use(readScale()); };
  document.addEventListener('pointerdown', h);
  return () => document.removeEventListener('pointerdown', h);
});
</script>
<template><div>{{ readScale() }}</div></template>
</rozie>`;

  it('a function-declaration helper is ref-routed like an arrow helper', () => {
    const code = compile(SRC_FUNCDECL);
    const mount = mountEffect(code);
    expect(code).toContain('const _readScaleRef = useRef(readScale);');
    expect(code).toContain('_readScaleRef.current = readScale;');
    expect(mount.body).toContain('_readScaleRef.current(');
    expect(bareCallCount(mount.body, 'readScale')).toBe(0);
  });

  it('snapshot — SRC_FUNCDECL', () => {
    expect(compile(SRC_FUNCDECL)).toMatchSnapshot();
  });
});

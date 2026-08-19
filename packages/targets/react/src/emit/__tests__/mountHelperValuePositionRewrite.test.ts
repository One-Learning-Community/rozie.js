/**
 * Quick 260806-w00 SEAM 4 (VP-01/VP-02/VP-03) — a top-level `<script>` helper
 * PASSED (not called) inside a `[]`-dep `$onMount` effect is frozen at the
 * first-render instance forever on React, exactly like the CALL flavour seam
 * 3 (`9acd7737`) fixed. Seam 3's D-03 deliberately excluded this shape: the
 * obvious fix — an inline `(...a) => _HRef.current(...a)` — mints a NEW
 * function identity and breaks the paired `removeEventListener(H)`.
 *
 * `document.addEventListener('pointerdown', H)` registers render #1's
 * closure forever. The only correct fix hoists ONE stable wrapper per
 * (helper, hook) and rewrites BOTH the registration and the de-registration
 * to use it — the registration/de-registration PAIRING is the whole
 * correctness crux (D-04): a wrapper minted independently at each call site
 * would still break the pairing.
 *
 * Harness (`compile` / `extractEffects` / `mountEffect`) copied verbatim from
 * `mountHelperCallRefRewrite.test.ts:31-99`, plus a `bareIdentifierCount`
 * helper generalizing that file's `bareCallCount` to non-call value
 * positions.
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

/**
 * `EmittedEffect.body` is the FULL callback text (`() => { ... }`), including
 * the arrow wrapper. A standalone `$onUnmount(fn)` lowers to
 * `useEffect(() => { return () => { fn(); } }, [])` — an EMPTY setup that
 * immediately returns the cleanup — so its inner content, once the arrow
 * wrapper is stripped, starts with `return () =>`.
 */
function isPureCleanupOnlyEffectBody(rawBody: string): boolean {
  const inner = rawBody.replace(/^\(\)\s*=>\s*\{/, '').replace(/\}\s*$/, '');
  return inner.trim().startsWith('return () =>');
}

function mountEffect(emitted: string): EmittedEffect {
  // A standalone `$onUnmount(fn)` ALSO lowers to a `[]`-dep `useEffect` (an
  // empty setup that returns the cleanup) — exclude those so a component
  // that pairs a mount hook with a sibling standalone unmount hook (V5) still
  // resolves to exactly one candidate: the hook with real setup code.
  const mounts = extractEffects(emitted).filter(
    (e) => e.deps === '[]' && !isPureCleanupOnlyEffectBody(e.body),
  );
  if (mounts.length !== 1) {
    throw new Error(
      `expected exactly one []-dep mount-setup effect, got ${mounts.length}:\n${emitted}`,
    );
  }
  return mounts[0]!;
}

/**
 * Count BARE invocations of `name` — i.e. `name(` not preceded by a `.`, a word
 * char or a `$`. `_<name>Ref.current(` / `_<name>Stable(` therefore never count.
 */
function bareCallCount(src: string, name: string): number {
  const re = new RegExp(String.raw`(?<![.\w$])${name}\s*\(`, 'g');
  return [...src.matchAll(re)].length;
}

/**
 * Count BARE occurrences of `name` in any position — call, value, whatever —
 * excluding occurrences embedded in a longer identifier. Both `_<name>Ref`
 * and `_<name>Stable` are prefixed with `_` (a word char), so the negative
 * lookbehind excludes them without any special-casing.
 */
function bareIdentifierCount(src: string, name: string): number {
  const re = new RegExp(String.raw`(?<![.\w$])${name}(?![\w$])`, 'g');
  return [...src.matchAll(re)].length;
}

describe('emitScript (React) — value-position helper references route through a stable wrapper (Quick 260806-w00 seam 4)', () => {
  // --- V1/V2/V3 (D-01, D-02, D-06 parity) -----------------------------------
  const SRC_PAIRED = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick = () => { use($props.gain); };
const staticHandler = () => { seed(42); };
$onMount(() => {
  document.addEventListener('pointerdown', onTick);
  document.addEventListener('resize', staticHandler);
  return () => {
    document.removeEventListener('pointerdown', onTick);
    document.removeEventListener('resize', staticHandler);
  };
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V1 (RED) — registration and de-registration resolve to the SAME wrapper, exactly one decl', () => {
    const code = compile(SRC_PAIRED);
    const mount = mountEffect(code);

    // Exactly ONE wrapper declaration, at the head of the effect body.
    const declMatches = code.match(/const _onTickStable[^=]*=/g) ?? [];
    expect(declMatches).toHaveLength(1);

    // BOTH the registration and de-registration read the wrapper.
    expect(mount.body).toContain("document.addEventListener('pointerdown', _onTickStable)");
    expect(mount.body).toContain("document.removeEventListener('pointerdown', _onTickStable)");

    // Placement: the wrapper decl comes BEFORE both the registration and the
    // de-registration — it must be in scope for each. `mount.body` includes
    // the arrow wrapper (`() => { ... }`), so check ordering by index rather
    // than assume the wrapper decl is the literal first character.
    const declAt = mount.body.indexOf('const _onTickStable');
    const registerAt = mount.body.indexOf(
      "document.addEventListener('pointerdown', _onTickStable)",
    );
    expect(declAt).toBeGreaterThan(-1);
    expect(declAt).toBeLessThan(registerAt);
  });

  it('V2 (RED) — the wrapper type annotation queries the ref, not the bare helper; no bare helper survives', () => {
    const code = compile(SRC_PAIRED);
    const mount = mountEffect(code);

    // The declared TYPE is a query over the REF (`typeof _onTickRef.current`),
    // never over the bare helper (`typeof onTick`) — this introduces no new
    // value-or-type reference to `onTick` for `exhaustive-deps` to see, and is
    // transparently stripped by the directive re-derivation's
    // `_[A-Za-z0-9_$]+Ref\.current` scrub.
    expect(code).toContain(
      'const _onTickStable: typeof _onTickRef.current = (...args) => _onTickRef.current(...args);',
    );
    expect(code).not.toContain('typeof onTick');

    // No bare reference to `onTick` survives in the emitted mount body.
    expect(bareIdentifierCount(mount.body, 'onTick')).toBe(0);
  });

  it('V3 (GREEN GUARD, D-06/D-02 parity) — a helper with an EMPTY dep array keeps its bare value position, mints no wrapper', () => {
    const code = compile(SRC_PAIRED);
    const mount = mountEffect(code);
    // `staticHandler` reads nothing reactive → `useCallback(fn, [])` → stable
    // identity by construction → the mount closure's captured instance IS the
    // current one. No staleness ⇒ no wrapper ⇒ byte-identical value position.
    expect(code).toContain('const staticHandler = useCallback(() => {\n    seed(42);\n  }, []);');
    expect(code).not.toContain('_staticHandlerStable');
    expect(code).not.toContain('_staticHandlerRef');
    expect(bareIdentifierCount(mount.body, 'staticHandler')).toBe(2);
  });

  it('snapshot — SRC_PAIRED', () => {
    expect(compile(SRC_PAIRED)).toMatchSnapshot();
  });

  // --- V4 (D-06 — non-mount phases stay bare) -------------------------------
  const SRC_NON_MOUNT = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick2 = () => { use($props.gain); };
$onUpdate(() => { document.addEventListener('pointerdown', onTick2); });
$watch(() => $props.gain, () => { document.addEventListener('pointerdown', onTick2); });
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V4 (GREEN GUARD, D-06) — the same value-position shape inside $onUpdate and $watch is byte-unchanged', () => {
    const code = compile(SRC_NON_MOUNT);
    expect(code).not.toContain('_onTick2Stable');
    // declaration + $onUpdate's closure-dep array entry + 2 addEventListener
    // call sites ($onUpdate + $watch); the watcher's OWN dep array is
    // getter-deps-only (`[props.gain]`), so it contributes no extra mention.
    expect(bareIdentifierCount(code, 'onTick2')).toBe(4);
  });

  it('snapshot — SRC_NON_MOUNT', () => {
    expect(compile(SRC_NON_MOUNT)).toMatchSnapshot();
  });

  // --- V5 (D-04 — the pairing-safety gate, the correctness crux) -----------
  const SRC_SIBLING_UNMOUNT = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick3 = () => { use($props.gain); };
$onMount(() => {
  document.addEventListener('pointerdown', onTick3);
});
$onUnmount(() => {
  document.removeEventListener('pointerdown', onTick3);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V5 (GREEN GUARD, D-04) — a sibling standalone $onUnmount de-registration keeps the mount value position bare', () => {
    const code = compile(SRC_SIBLING_UNMOUNT);
    const mount = mountEffect(code);
    // The registration is in the MOUNT hook; the de-registration is in a
    // DIFFERENT lifecycle hook (a standalone $onUnmount, a separate
    // `useEffect` closure). Wrapping only the mount side would leave the
    // sibling hook's bare `onTick3` unmatched — a listener leak. So: no
    // wrapper minted at all.
    expect(code).not.toContain('_onTick3Stable');
    expect(mount.body).toContain("document.addEventListener('pointerdown', onTick3)");
  });

  it('snapshot — SRC_SIBLING_UNMOUNT', () => {
    expect(compile(SRC_SIBLING_UNMOUNT)).toMatchSnapshot();
  });

  // --- V6 (RED — D-07 composition: CALL + PASS, same helper) ---------------
  const SRC_CALL_AND_PASS = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const combo = () => { use($props.gain); };
$onMount(() => {
  use(combo());
  document.addEventListener('pointerdown', combo);
  return () => document.removeEventListener('pointerdown', combo);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V6 (RED) — a hook that both CALLS and PASSES the same helper routes each through its own mechanism, dep dropped', () => {
    const code = compile(SRC_CALL_AND_PASS);
    const mount = mountEffect(code);

    // The CALL routes through the synced ref (seam 3's existing mechanism).
    expect(mount.body).toContain('_comboRef.current()');
    expect(bareCallCount(mount.body, 'combo')).toBe(0);

    // The VALUE positions route through the wrapper.
    expect(mount.body).toContain("document.addEventListener('pointerdown', _comboStable)");
    expect(mount.body).toContain("document.removeEventListener('pointerdown', _comboStable)");

    // No bare reference to `combo` survives anywhere in the mount body.
    expect(bareIdentifierCount(mount.body, 'combo')).toBe(0);

    // Zero surviving residual references ⇒ the D-07 filter drops `combo`'s
    // dep from the directive-flaggable set ⇒ no eslint-disable directive.
    expect(code).not.toContain('eslint-disable-line react-hooks/exhaustive-deps');
  });

  it('snapshot — SRC_CALL_AND_PASS', () => {
    expect(compile(SRC_CALL_AND_PASS)).toMatchSnapshot();
  });

  // --- V7 (D-11 parity — shadow guard) --------------------------------------
  const SRC_SHADOW = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick4 = () => { use($props.gain); };
$onMount(() => {
  const onTick4 = () => 7;
  document.addEventListener('x', onTick4);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V7 (GREEN GUARD, D-11 parity) — a locally-shadowed name keeps its bare reference', () => {
    const code = compile(SRC_SHADOW);
    const mount = mountEffect(code);
    expect(mount.body).toContain('const onTick4 = () => 7;');
    expect(mount.body).toContain("document.addEventListener('x', onTick4)");
    expect(code).not.toContain('_onTick4Stable');
  });

  it('snapshot — SRC_SHADOW', () => {
    expect(compile(SRC_SHADOW)).toMatchSnapshot();
  });

  // --- V8 (D-05 — wrapper-identifier collision guard) -----------------------
  const SRC_WRAPPER_COLLIDE = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 }, _onTickStable: { type: Number, default: 0 } }</props>
<script>
const onTick = () => { use($props.gain); };
$onMount(() => {
  document.addEventListener('pointerdown', onTick);
  return () => document.removeEventListener('pointerdown', onTick);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V8 (GREEN GUARD, D-05) — a helper whose wrapper ident would collide with a prop is skipped entirely', () => {
    const code = compile(SRC_WRAPPER_COLLIDE);
    const mount = mountEffect(code);
    // Seam 2 mints `const _onTickStableRef = useRef(props._onTickStable);` for
    // the PROP `_onTickStable`. The wrapper for helper `onTick` would be
    // named `_onTickStable` too — a literal TS2451 collision — so it is
    // skipped and the value position stays bare.
    const wrapperDecls = code.match(/const _onTickStable(?!Ref):/g) ?? [];
    expect(wrapperDecls).toHaveLength(0);
    expect(mount.body).toContain("document.addEventListener('pointerdown', onTick)");
    expect(mount.body).toContain("document.removeEventListener('pointerdown', onTick)");
  });

  it('snapshot — SRC_WRAPPER_COLLIDE', () => {
    expect(compile(SRC_WRAPPER_COLLIDE)).toMatchSnapshot();
  });

  // --- V9 (D-04 — template value positions excluded from the census) -------
  const SRC_TEMPLATE_VALUE_POS = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const onTick5 = () => { use($props.gain); };
$onMount(() => {
  document.addEventListener('pointerdown', onTick5);
  return () => document.removeEventListener('pointerdown', onTick5);
});
</script>
<template><button @click="onTick5">Go</button></template>
</rozie>`;

  it('V9 (GREEN GUARD, D-04) — a helper referenced in value position from the TEMPLATE is untouched in the template emit; the mount body still wraps', () => {
    const code = compile(SRC_TEMPLATE_VALUE_POS);
    const mount = mountEffect(code);
    // The mount body's registration/de-registration pairing is confined to
    // ONE hook and is unaffected by the template reference — the census
    // deliberately does not walk template/JSX, so this still wraps.
    expect(mount.body).toContain("document.addEventListener('pointerdown', _onTick5Stable)");
    expect(mount.body).toContain("document.removeEventListener('pointerdown', _onTick5Stable)");
    // The TEMPLATE's own emit stays bare — React re-attaches JSX handlers per
    // render, so there is no paired de-registration to protect there. (The
    // root element merges `attrs`, so the handler is spread via
    // `mergeListeners({ onClick: onTick5 }, attrs)` rather than a literal
    // `onClick={onTick5}` JSX attribute — either way, the reference is bare.)
    expect(code).toContain('onClick: onTick5');
    expect(code).not.toContain('onClick: _onTick5Stable');
  });

  it('snapshot — SRC_TEMPLATE_VALUE_POS', () => {
    expect(compile(SRC_TEMPLATE_VALUE_POS)).toMatchSnapshot();
  });

  // --- V10 (regression, found during Task 3 leaf regen: tiptap TipTap.tsx) -
  // A SHORTHAND object property (`{ handlePaste }`) has a VALUE slot whose
  // identifier doubles as the PROPERTY NAME. Naively `path.replaceWith`-ing
  // the value node left `shorthand: true` with a mismatched key/value name,
  // which the generator resolved by also silently renaming the KEY —
  // `{ handlePaste }` became `{ _handlePasteStable }`. Any downstream
  // consumer that spreads the object and expects an EXACT property name
  // (ProseMirror's `editorProps.handlePaste`/`.handleDrop`) would silently
  // stop receiving the callback — a real regression, not just byte churn.
  const SRC_SHORTHAND_PROPERTY = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const handlePaste = () => { use($props.gain); };
$onMount(() => {
  const uploadHandlers = { handlePaste };
  seed(uploadHandlers);
  return () => document.removeEventListener('paste', handlePaste);
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('V10 (regression) — a shorthand object property value is wrapped WITHOUT renaming the property key', () => {
    const code = compile(SRC_SHORTHAND_PROPERTY);
    const mount = mountEffect(code);
    // The property NAME must survive untouched — only its value is indirected.
    expect(mount.body).toContain('handlePaste: _handlePasteStable');
    expect(code).not.toContain('{ _handlePasteStable }');
    expect(code).not.toContain('_handlePasteStable,');
  });

  it('snapshot — SRC_SHORTHAND_PROPERTY', () => {
    expect(compile(SRC_SHORTHAND_PROPERTY)).toMatchSnapshot();
  });
});

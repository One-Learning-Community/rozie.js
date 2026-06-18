/**
 * Phase 46 ITEM-5 — unified target-parameterized deconfliction pass (D-02).
 *
 * Proves the ONE pass subsumes the three prior point-fixes (React
 * deconflictRefShadows + Svelte deconflictAccessorShadows + React ROZ524) and
 * adds the class-target reserved-member sub-case (Object.prototype on
 * Angular+Lit, inherited HTMLElement members on Lit) — all via the same
 * `X$local` suffix, only-on-collision, renameable-side-only.
 */
import { describe, it, expect } from 'vitest';
import { compile, type CompileTarget } from '../src/index.js';
import {
  OBJECT_PROTOTYPE_MEMBERS,
  LIT_DOM_INHERITED_MEMBERS,
  reservedClassMembers,
} from '../src/rewrite/deconflict.js';

const ALL: CompileTarget[] = ['react', 'svelte', 'angular', 'vue', 'solid', 'lit'];

function compileOk(src: string, target: CompileTarget, filename = 'Probe.rozie'): string {
  const r = compile(src, { target, filename });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  expect(errs, `${target} compile errors: ${JSON.stringify(errs)}`).toHaveLength(0);
  expect(r.code).not.toBe('');
  return r.code;
}

describe('reserved class-member sets (D-02 data)', () => {
  it('Object.prototype set includes valueOf/toString/hasOwnProperty/constructor', () => {
    for (const m of ['valueOf', 'toString', 'hasOwnProperty', 'isPrototypeOf']) {
      expect(OBJECT_PROTOTYPE_MEMBERS.has(m)).toBe(true);
    }
  });
  it('Lit inherited-DOM set includes focus/scrollTo/nodeType/blur', () => {
    for (const m of ['focus', 'scrollTo', 'nodeType', 'blur', 'click']) {
      expect(LIT_DOM_INHERITED_MEMBERS.has(m)).toBe(true);
    }
  });
  it('Lit reserved = Object.prototype ∪ DOM; Angular reserved = Object.prototype only', () => {
    expect(reservedClassMembers('angular').has('valueOf')).toBe(true);
    expect(reservedClassMembers('angular').has('focus')).toBe(false);
    expect(reservedClassMembers('lit').has('valueOf')).toBe(true);
    expect(reservedClassMembers('lit').has('focus')).toBe(true);
  });
});

describe('$data-key == $expose-verb collision (the listbox `open` footgun)', () => {
  // `open` is a $data key AND an $expose verb. React lowers $data.open to a bare
  // `open` useState binding; the $expose verb `open` is the public contract.
  // Renameable side = the $data local → `open$local`; the verb stays.
  const SRC = `
<rozie name="OpenProbe">
<data>{ open: false }</data>
<script lang="ts">
const toggle = () => { $data.open = !$data.open }
$expose({ open: () => { $data.open = true } })
</script>
<template><button @click="toggle">x</button></template>
</rozie>
`;
  it('all six targets compile without error', () => {
    for (const target of ALL) compileOk(SRC, target);
  });
  it('the $expose verb `open` is preserved; the colliding state is renamed open$local', () => {
    for (const target of ALL) {
      const code = compileOk(SRC, target);
      // The colliding state key is renamed to open$local (the renameable side).
      expect(code, `${target} state should be open$local`).toMatch(/open\$local/);
      // The exposed verb `open` (the public handle key) is preserved unsuffixed.
      // (React useImperativeHandle / Vue defineExpose / Svelte export / etc.)
      expect(code, `${target} exposed verb should stay 'open'`).toMatch(/\bopen\b/);
    }
  });
});

describe('$data-key == $expose-verb with a NAMED exposed function (listbox `open`)', () => {
  // The HARD case the listbox `expanded` workaround avoids: a `<data>` key `open`
  // AND a top-level `const open = () => ...` function that IS the `$expose` verb.
  // Five of six targets would otherwise emit a duplicate `open` binding or bind
  // the handle to the state value. The shared state-key rename moves the STATE to
  // `open$local`, leaving the exposed `open()` function intact on all six.
  const SRC = `
<rozie name="OpenFn">
<data>{ open: false }</data>
<script lang="ts">
const setOpenState = (n: boolean) => { $data.open = n }
const open = () => { setOpenState(true) }
const close = () => { setOpenState(false) }
const toggle = () => { setOpenState(!$data.open) }
$expose({ open, close })
</script>
<template><button @click="toggle">{{ $data.open ? 'y' : 'n' }}</button></template>
</rozie>
`;
  it('all six targets compile without error (no duplicate binding)', () => {
    for (const target of ALL) compileOk(SRC, target);
  });
  it('the state key is renamed open$local; the exposed open verb is preserved', () => {
    for (const target of ALL) {
      const code = compileOk(SRC, target);
      // State moved to open$local (the bare-ident + class targets all reflect it
      // somewhere — useState/$state/signal/this.open$local).
      expect(code, `${target} should rename state to open$local`).toMatch(/open\$local/);
    }
  });
  it('React binds the exposed handle to the open() function, not the state value', () => {
    const code = compileOk(SRC, 'react');
    // The exposed `open` must be the user function (un-suffixed), and the state
    // is `open$local`. The function must NOT be renamed to open$local.
    // 260618-ao9 — the handle is now a stable-identity dispatch form: each verb
    // dispatches through `_rozieExposeRef.current.<verb>`. Assert the `open` verb
    // is present in the handle factory body via its dispatch wrapper.
    expect(code).toMatch(/useImperativeHandle\(ref,\s*\(\)\s*=>\s*\(\{/);
    expect(code).toMatch(/open:\s*\(\.\.\.args[^)]*\)[^=]*=>\s*_rozieExposeRef\.current\.open\(\.\.\.args\)/);
    expect(code).toMatch(/const\s+\[open\$local\s*,\s*setOpen\$local\]\s*=\s*useState/);
    expect(code).not.toMatch(/function open\$local|const open\$local\s*=\s*\(\)/);
  });
});

describe('React ROZ524 fold — user helper named setX auto-renames', () => {
  // `view` is a model prop → React mints `setView`. A user helper also named
  // `setView` previously errored (ROZ524). Now it auto-renames to setView$local.
  const SRC = `
<rozie name="SetterProbe">
<props>{ view: { type: String, default: 'a', model: true } }</props>
<script lang="ts">
const setView = (v: string) => { $model.view = v }
const go = () => { setView('b') }
</script>
<template><button @click="go">go</button></template>
</rozie>
`;
  it('React compiles without ROZ524 and renames the user helper to setView$local', () => {
    const r = compile(SRC, { target: 'react', filename: 'SetterProbe.rozie' });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs, JSON.stringify(errs)).toHaveLength(0);
    expect(r.code).toMatch(/setView\$local/);
  });
});

describe('non-colliding corpus stays byte-identical (only-on-collision)', () => {
  // No collision anywhere — must contain NO $local suffix on any target.
  const SRC = `
<rozie name="CleanProbe">
<data>{ count: 0 }</data>
<script lang="ts">
const inc = () => { $data.count = $data.count + 1 }
</script>
<template><button @click="inc">{{ $data.count }}</button></template>
</rozie>
`;
  it('emits no $local suffix on any target', () => {
    for (const target of ALL) {
      const code = compileOk(SRC, target);
      expect(code, target).not.toMatch(/\$local/);
    }
  });
});

describe('reserved-member name that IS an $expose verb stays public (D-02)', () => {
  // `focus` is a reserved Lit DOM member AND a deliberately-exposed element
  // method. The public `focus()` contract must NEVER be renamed to focus$local.
  const SRC = `
<rozie name="FocusProbe">
<script lang="ts">
const focus = () => { /* focus the field */ }
$expose({ focus })
</script>
<template><div>x</div></template>
</rozie>
`;
  it('Lit + Angular keep the exposed `focus` method (no $local suffix)', () => {
    for (const target of ['lit', 'angular'] as CompileTarget[]) {
      const code = compileOk(SRC, target);
      expect(code, target).not.toMatch(/focus\$local/);
      expect(code, target).toMatch(/\bfocus\b/);
    }
  });
});

describe('Lit class-target reserved-member sub-case (valueOf footgun)', () => {
  // A user local named `valueOf` becomes a class field on Lit/Angular and
  // breaks Object-assignability → TS1240/TS1271 cascade. Must auto-rename.
  const SRC = `
<rozie name="ReservedProbe">
<data>{ items: [] }</data>
<script lang="ts">
const valueOf = () => { return $data.items.length }
const go = () => { return valueOf() }
</script>
<template><button @click="go">x</button></template>
</rozie>
`;
  it('Lit + Angular compile without error and rename the user local', () => {
    for (const target of ['lit', 'angular'] as CompileTarget[]) {
      const code = compileOk(SRC, target);
      expect(code, target).toMatch(/valueOf\$local/);
    }
  });
});

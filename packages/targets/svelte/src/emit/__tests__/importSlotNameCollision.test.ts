/**
 * Quick 260717-8zb (Task 2 Item 4) — top-level import identifier == slot-name
 * collision auto-fix (Svelte target, Class 3 of findRForSlotNameCollisions).
 *
 * A top-level `<script>` import whose LOCAL binding name equals a declared
 * `<slot name="X">` collides with the Svelte emitter's `const X =
 * $derived(...)` slot-merge declaration — both are top-level `<script>`
 * bindings sharing ONE program scope, so the merge decl is a DUPLICATE
 * declaration of the import name → a hard Svelte "already declared" compile
 * error, Svelte-only (the other five targets have no equivalent slot-merge
 * const). CommandPalette.rozie previously sidestepped this by aliasing its
 * `breadcrumb` import to `buildBreadcrumb` at the SOURCE level.
 *
 * The Svelte emitter auto-fixes this the same way it already fixes Class 1
 * (r-for-loop-var) and Class 2 (script-param) collisions: rename ONLY the
 * emitter-generated snippet/merge binding (and every reference — render
 * site, `$slots.X`/`$portals.X` rewrites) to the safe suffixed `X$$slot`.
 * The author's import identifier stays exactly as-authored. CONDITIONAL:
 * only colliding slots are renamed, so non-colliding components emit
 * byte-identical Svelte.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { findRForSlotNameCollisions } from '../../../../../core/src/ir/findRForSlotNameCollisions.js';
import { emitSvelte } from '../../emitSvelte.js';

function lower(rozieSrc: string) {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir, diagnostics } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return { ir, diagnostics };
}

function compileSvelte(rozieSrc: string): string {
  const { ir } = lower(rozieSrc);
  return emitSvelte(ir, { filename: 'Test.rozie', source: rozieSrc }).code;
}

// Top-level import `breadcrumb` collides with `<slot name="breadcrumb">`.
const COLLIDING = `<rozie name="X">
<script>
import { breadcrumb } from './helpers.js'
const label = () => breadcrumb('root')
</script>
<template>
  <div>
    <slot name="breadcrumb">{{ label() }}</slot>
  </div>
</template>
</rozie>`;

// A DIFFERENTLY-named import — no collision.
const NON_COLLIDING = `<rozie name="X">
<script>
import { buildBreadcrumb } from './helpers.js'
const label = () => buildBreadcrumb('root')
</script>
<template>
  <div>
    <slot name="breadcrumb">{{ label() }}</slot>
  </div>
</template>
</rozie>`;

describe('findRForSlotNameCollisions — Class 3 (top-level import identifier)', () => {
  it('returns the colliding slot name when a top-level import local name equals the slot name', () => {
    const { ir } = lower(COLLIDING);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set(['breadcrumb']));
  });

  it('returns empty when the import name differs from the slot name', () => {
    const { ir } = lower(NON_COLLIDING);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set());
  });
});

describe('Svelte emit — import/slot-name collision auto-fix', () => {
  it('renames the slot-merge identifier to `breadcrumb$$slot`, leaving the import untouched', () => {
    const code = compileSvelte(COLLIDING);
    // The import identifier is untouched (bare, as authored).
    expect(code).toMatch(/import\s*\{\s*breadcrumb\s*\}\s*from\s*'\.\/helpers\.js'/);
    // The slot-merge binding is renamed — no duplicate `const breadcrumb` /
    // `let breadcrumb` declaration collides with the import.
    expect(code).toMatch(/breadcrumb\$\$slot/);
    // No Svelte "already declared" shape: the import name must not ALSO be
    // re-declared as a top-level const/let (the pre-fix broken shape).
    const declCount = (code.match(/(?:const|let)\s+breadcrumb\b(?!\$\$slot)/g) ?? []).length;
    expect(declCount).toBe(0);
  });

  it('non-colliding components stay on the bare slot-merge identifier (byte-stable)', () => {
    const code = compileSvelte(NON_COLLIDING);
    expect(code).not.toMatch(/breadcrumb\$\$slot/);
  });
});

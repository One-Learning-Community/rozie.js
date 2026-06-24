/**
 * litReservedDeconflict.test.ts — Phase 61 Plan 03 (SC-2, Lit leg).
 *
 * R-NEW-1 ($computed == reserved-member) + R-NEW-5 ($inject-local ==
 * reserved-member): a Lit `$computed` const or `$inject` local binding whose
 * name is a reserved class member (inherited HTMLElement/Element/Node member,
 * Object.prototype member, or a Lit lifecycle name) becomes a PUBLIC `get X()`
 * getter on the LitElement class, shadowing the inherited member → gate-3
 * TS2611/TS2416. These names are INTERNAL (template/method-referenced, not
 * consumer-facing) → safe to auto-rename to `X$local`.
 *
 * This file is RED-FIRST for Task 1: it pins the PRE-FIX collision (a bare
 * `get id()` on the class). Task 2 flips the assertions to the post-fix
 * `id$local` shape (the rename propagating to the template interpolation).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../../__tests__/fixtures/LitComputedReserved.rozie');

function compileToLit(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  const { code } = emitLit(ir, { filename, source, modifierRegistry: registry });
  return code;
}

function compileInline(src: string): string {
  return compileToLit(src, 'Inline.rozie');
}

describe('Lit reserved-member deconfliction — $computed + $inject local (SC-2)', () => {
  it('$computed named a reserved member (`id`) renames to `id$local` getter', () => {
    const source = readFileSync(FIXTURE, 'utf8');
    const code = compileToLit(source, 'LitComputedReserved.rozie');
    // Post-fix: the getter is renamed, and the bare `get id()` is gone (no more
    // HTMLElement.id shadow). The template interpolation references the rename.
    expect(code).toContain('get id$local()');
    expect(code).not.toMatch(/\bget id\(\)/);
    // The template interpolation `{{ id }}` references the renamed getter.
    expect(code).toContain('this.id$local');
  });

  it('a NON-colliding $computed (`doubled`) is byte-identical (no rename)', () => {
    const src = `<rozie name="PlainComputed">
<props>
{ value: { type: Number, default: 1 } }
</props>
<script lang="ts">
const doubled = $computed(() => $props.value * 2);
</script>
<template>
<div>{{ doubled }}</div>
</template>
</rozie>`;
    const code = compileInline(src);
    // Non-collision: the getter stays `get doubled()` — NO `$local` suffix.
    expect(code).toContain('get doubled()');
    expect(code).not.toContain('doubled$local');
  });

  it('$inject local named a reserved member (`title`) renames to `title$local`', () => {
    const src = `<rozie name="InjectReserved">
<script lang="ts">
const title = $inject('headingCtx');
</script>
<template>
<div>{{ title.text }}</div>
</template>
</rozie>`;
    const code = compileInline(src);
    // The ContextConsumer read accessor is renamed; the colliding bare
    // `get title()` (HTMLElement.title shadow) is gone.
    expect(code).toContain('get title$local()');
    expect(code).not.toMatch(/\bget title\(\)/);
    expect(code).toContain('this.title$local');
  });

  it('a NON-colliding $inject local (`theme`) is unchanged', () => {
    const src = `<rozie name="InjectPlain">
<script lang="ts">
const theme = $inject('theme');
</script>
<template>
<button>{{ theme.color }}</button>
</template>
</rozie>`;
    const code = compileInline(src);
    expect(code).toContain('get theme()');
    expect(code).not.toContain('theme$local');
  });
});

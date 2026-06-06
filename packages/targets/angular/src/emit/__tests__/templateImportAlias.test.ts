/**
 * templateImportAlias.test.ts — Angular emitter regression for the
 * "<script> value-import referenced in a template expression" scope gap.
 *
 * Angular AOT evaluates template-binding identifiers against the COMPONENT
 * INSTANCE, but `<script>` imports are hoisted to module scope (partitionUserImports
 * → ShellParts.userImports) and are NOT class members. So a template binding
 * referencing an imported symbol (`:options="{ plugins: [listPlugin] }"`) lowers
 * to a bare instance lookup that does not exist → `undefined` at runtime, and
 * because the import's only reference lives in the separate template compilation
 * context, the bundler tree-shakes it away (FullCalendar then crashes in
 * buildPluginHooks reading 'name').
 *
 * FIX: the Angular emitter aliases each value-import whose local name appears in
 * a template-context expression to a `protected readonly <name> = <name>;`
 * component field — the field name === the import local name so the UNCHANGED
 * bare template reference resolves against `this`, and the initializer keeps the
 * module import live. `protected readonly` because AOT template type-checking
 * cannot see `private` members.
 *
 * The other five targets share one scope (React/Solid emit JSX in the import's
 * module; Vue/Svelte single-file; Lit's html`` is a class method in module
 * scope), so they emit NOTHING new — the negative cross-target case asserts a
 * React compile of the same source carries no alias.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { compile } from '../../../../../core/src/compile.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import { emitAngular } from '../../emitAngular.js';

function compileAngular(src: string, filename = 'Test.rozie'): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error('lowerToIR() returned null IR');
  }
  const ir: IRComponent = lowered.ir;
  return emitAngular(ir, { filename, source: src }).code;
}

describe('emitAngular — template-referenced <script> value-import alias', () => {
  it('(1) default value-import referenced ONLY in a template binding → protected readonly alias + retained import', () => {
    const code = compileAngular(`<rozie name="Test">
<components>
{ Child: './Child.rozie' }
</components>
<script>
import listPlugin from '@fullcalendar/list'
</script>
<template>
  <Child :options="{ plugins: [listPlugin] }"></Child>
</template>
</rozie>`);

    // The alias field — exactly `protected readonly listPlugin = listPlugin;`.
    expect(code).toContain('protected readonly listPlugin = listPlugin;');
    // The module import stays live (not tree-shaken / dropped from emit).
    expect(code).toContain("import listPlugin from '@fullcalendar/list';");
    // The bare template reference is UNCHANGED — no `this.` rewrite (Angular
    // templates reference members bare); the alias resolves it against `this`.
    expect(code).toContain('[options]="{ plugins: [listPlugin] }"');
    // protected/readonly are load-bearing: AOT cannot see `private` members.
    expect(code).not.toContain('private listPlugin');
    // Exactly ONE alias field (no duplicate).
    const aliasCount = (
      code.match(/protected readonly listPlugin = listPlugin;/g) ?? []
    ).length;
    expect(aliasCount).toBe(1);
  });

  it('(2) NAMED value-import referenced in a template binding → alias on the local name', () => {
    const code = compileAngular(`<rozie name="Test">
<script>
import { thePlugin } from 'thing'
</script>
<template>
  <div :data-x="thePlugin"></div>
</template>
</rozie>`);
    expect(code).toContain('protected readonly thePlugin = thePlugin;');
    expect(code).toContain("import { thePlugin } from 'thing';");
  });

  it('(3) value-import referenced inside an @event handler expression → alias', () => {
    const code = compileAngular(`<rozie name="Test">
<script>
import doThing from 'thing'
</script>
<template>
  <button @click="doThing()">go</button>
</template>
</rozie>`);
    expect(code).toContain('protected readonly doThing = doThing;');
    expect(code).toContain("import doThing from 'thing';");
  });

  it('(4-negative) value-import referenced ONLY in <script> (never in template) → NO alias', () => {
    const code = compileAngular(`<rozie name="Test">
<script>
import sideEffect from 'thing'
$onMount(() => { sideEffect(); return undefined; })
</script>
<template>
  <div>hi</div>
</template>
</rozie>`);
    // sideEffect works via the module import inside the lifecycle body; no alias.
    expect(code).not.toContain('protected readonly sideEffect');
    // The import itself is still present (used in <script>).
    expect(code).toContain("import sideEffect from 'thing';");
  });

  it('(5-negative) type-only import → NEVER aliased (TS erases it)', () => {
    const code = compileAngular(`<rozie name="Test">
<script lang="ts">
import type { Opts } from 'thing'
const x: Opts = {}
</script>
<template>
  <div>{{ x }}</div>
</template>
</rozie>`);
    // `Opts` is a type — must not become a runtime field. `x` is the value,
    // declared in <script>, and is not a value-import.
    expect(code).not.toContain('protected readonly Opts');
    expect(code).not.toContain('readonly x = x');
  });

  it('(6-collision) import name colliding with a declared prop → NO duplicate alias field', () => {
    // `value` is both a model prop AND an import local name (an author-level
    // clash). The import is referenced in the template, but `value` is already a
    // class member (`value = model<…>()`), so we must NOT emit a second
    // `protected readonly value = value;` field (it would shadow / duplicate).
    const code = compileAngular(`<rozie name="Test">
<props>
{ value: { type: String, model: true } }
</props>
<script>
import value from 'thing'
</script>
<template>
  <div :data-x="value"></div>
</template>
</rozie>`);
    expect(code).not.toContain('protected readonly value = value;');
  });

  it('(7-cross-target) the SAME source emits NO alias on a non-Angular target (react)', () => {
    const src = `<rozie name="Test">
<components>
{ Child: './Child.rozie' }
</components>
<script>
import listPlugin from '@fullcalendar/list'
</script>
<template>
  <Child :options="{ plugins: [listPlugin] }"></Child>
</template>
</rozie>`;
    const react = compile(src, { target: 'react', filename: 'Test.rozie' });
    expect(react.code).not.toContain('protected readonly');
    expect(react.code).not.toContain('readonly listPlugin = listPlugin');
    // React shares one module scope — the import is referenced directly in the
    // emitted JSX, no aliasing needed.
    expect(react.code).toContain('listPlugin');
  });
});

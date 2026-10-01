/**
 * Typed public surface P1 — final fix wave I3 + M4.
 *
 * I3: a `<types>` name that collides with a name some target GENERATES
 * (`<Name>Props`, `<Name>Handle`, `Rozie<Name>EventMap`, the component name,
 * Svelte's `Props`, Solid's `JSX`, slot ctx interfaces) used to compile with
 * zero Rozie diagnostics and then fail the leaf build with TS2300/TS2395.
 * Likewise a `<types>` binding that collides with a top-level `<script>`
 * declaration in the shared module scope. Both are now ROZ025 at lowering,
 * located at the `<types>` identifier, with a rename hint. The reserved list
 * comes from the same core name builders every emitter uses.
 *
 * M4: ROZ024 reads the same (post-partial-inlining) script program the module
 * dedupe reads, so a `.rzts` partial's import cannot slip past it.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../compile.js';
import { reservedGeneratedTypeNames } from '../codegen/generatedTypeNames.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

const host = (types: string, extra = '', script = "function go() { $emit('ping') }") => `<rozie name="Col">
<types>
${types}
</types>
<emits>
{ ping: {} }
</emits>
<script>
${script}
</script>
<template>
  <div @click="go()">
    <slot :count="1" />
    <slot name="row" :index="1" />
    <slot name="plain" />
    ${extra}
  </div>
</template>
</rozie>`;

function roz025(src: string, target: (typeof TARGETS)[number] = 'react') {
  const r = compile(src, { target, filename: 'Col.rozie', sourceMap: false });
  return r.diagnostics.filter((d) => d.code === 'ROZ025');
}

describe('ROZ025 — <types> name collides with a generated name (I3)', () => {
  const reserved = [
    'ColProps',
    'ColHandle',
    'RozieColEventMap',
    'Col',
    'Props',
    'JSX',
    // slot ctx interfaces — default slot with params
    'ChildrenCtx',
    'DefaultSlotCtx',
    'DefaultCtx',
    'RozieDefaultSlotCtx',
    // named slot `row` with params
    'RowCtx',
    'RowSlotCtx',
    'RozieRowSlotCtx',
  ];
  for (const name of reserved) {
    it(`\`export interface ${name}\` is a located ROZ025 error on every target`, () => {
      const src = host(`export interface ${name} { a: number }`);
      for (const target of TARGETS) {
        const ds = roz025(src, target);
        expect(ds, target).toHaveLength(1);
        expect(ds[0]!.severity).toBe('error');
        expect(src.slice(ds[0]!.loc.start, ds[0]!.loc.end)).toBe(name);
        expect(ds[0]!.hint).toMatch(/rename/i);
      }
    });
  }
  it('a type alias, an import and an export alias are covered too', () => {
    for (const types of [
      'export type ColProps = { a: number }',
      "import type { JSX } from 'solid-js'\nexport type A = JSX.Element",
      "import type { Thing } from './lib'\nexport type { Thing as ColHandle }",
    ]) {
      expect(roz025(host(types)), types).toHaveLength(1);
    }
  });
  it('a slot without params mints no ctx interface, so its ctx name is free', () => {
    expect(roz025(host('export interface PlainCtx { a: number }\nexport interface PlainSlotCtx { b: number }'))).toEqual([]);
  });
  it('the reserved list is derived from the shared name builders', () => {
    const { ast } = parse(host('export type A = number'), { filename: 'Col.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const names = [...reservedGeneratedTypeNames(ir!).keys()];
    expect(names).toEqual(expect.arrayContaining(['ColProps', 'RowCtx', 'RozieRowSlotCtx', 'DefaultSlotCtx']));
    expect(names).not.toContain('PlainCtx');
  });
  it('ordinary names compile clean (no false positives)', () => {
    expect(roz025(host('export interface Row { a: number }\nexport type ColInfo = Row'))).toEqual([]);
  });
});

describe('ROZ025 — <types> binding collides with a top-level <script> declaration (I3 / T18)', () => {
  const cases: Array<[string, string, string]> = [
    ["import type { Foo } from 'foo-lib'", 'const Foo = 1', 'Foo'],
    ["import type { Foo } from 'foo-lib'", 'let Foo = 1', 'Foo'],
    ["import type { Foo } from 'foo-lib'", 'function Foo() { return 1 }', 'Foo'],
    ["import type { Foo } from 'foo-lib'", 'class Foo {}', 'Foo'],
    ['export type Baz = { z: number }', 'class Baz {}', 'Baz'],
    ['export interface Qux { a: number }', "import { Qux } from './qux'", 'Qux'],
  ];
  for (const [types, decl, name] of cases) {
    it(`<types> \`${types}\` vs <script> \`${decl}\``, () => {
      const src = host(types, '', `${decl}\nfunction go() { $emit('ping') }`);
      for (const target of TARGETS) {
        const ds = roz025(src, target);
        expect(ds, target).toHaveLength(1);
        expect(src.slice(ds[0]!.loc.start, ds[0]!.loc.end)).toBe(name);
      }
    });
  }
  it('a type-space <types> name next to a value-only <script> name is legal TS (no error)', () => {
    const src = host('export interface Foo { a: number }', '', "const Foo = 1\nfunction go() { $emit('ping', Foo) }");
    expect(roz025(src)).toEqual([]);
  });
  it('lang="ts" <script> type declarations are hoisted to module scope — a same-named <types> type is ROZ025', () => {
    const src = host('export interface Qux { a: number }', '', "interface Qux { b: string }\nfunction go() { $emit('ping') }").replace(
      '<script>',
      '<script lang="ts">',
    );
    expect(roz025(src)).toHaveLength(1);
  });
});

describe('ROZ024/ROZ025 read the post-partial-inlining script program (M4)', () => {
  function withPartial(partial: string, types: string): string[] {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rozie-m4-')));
    try {
      writeFileSync(join(dir, 'logic.rzts'), partial, 'utf8');
      const src = `<rozie name="Host">
<types>
${types}
</types>
<script>
import { helper } from './logic.rzts'
$onMount(() => { helper() })
</script>
<template><div /></template>
</rozie>`;
      const hostPath = join(dir, 'Host.rozie');
      writeFileSync(hostPath, src, 'utf8');
      const r = compile(src, { target: 'react', filename: hostPath, resolverRoot: dir });
      return r.diagnostics.map((d) => d.code);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  it("a partial's import that conflicts with a <types> import is ROZ024", () => {
    const codes = withPartial(
      "import { Thing } from './other'\nexport function helper() { return new Thing() }\n",
      "import type { Thing } from './lib'\nexport type T = Thing",
    );
    expect(codes).toContain('ROZ024');
  });
  it("a partial's class that collides with a <types> type alias is ROZ025", () => {
    const codes = withPartial(
      'class Baz {}\nexport function helper() { return new Baz() }\n',
      'export type Baz = { z: number }',
    );
    expect(codes).toContain('ROZ025');
  });
});

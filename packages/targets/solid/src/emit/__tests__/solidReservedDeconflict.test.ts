/**
 * Solid reserved-name deconfliction — Phase 61 Plan 06 (Half A, SC-2).
 *
 * Solid's deconfliction registered ONLY `solidProps` (accessor `$props`) +
 * `solidSetters` (binding). `<data>` getters, `$computed` consts, and the
 * `<name>Ref`-suffixed ref locals were minted as bare top-level consts in NO
 * `GeneratedSymbolGroup`, so they collided with:
 *
 *   - bare solid-js imports (`children`/`on`/`For`)        → TS2440/TS2451
 *   - emitter locals (`local`/`attrs`/`_merged`/`resolved`/`portals`) → TS2451
 *   - sibling consts (`<data> x` vs `$computed x`)         → TS2451
 *
 * and `$expose({ value })` where `value` is a `$computed` silently referenced
 * the memo getter (the IR pass walked only `ir.state`).
 *
 * This plan adds the binding groups + extends `deconflictStateExposeCollision`
 * to walk `ir.computed`. All renames are INTERNAL → `X$local`. The public
 * contract (prop names, `$expose` verbs) is NEVER renamed. Off-collision
 * components stay byte-identical (verified against the unchanged corpus by the
 * snapshot + dist-parity suites).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../../emitSolid.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../__tests__/fixtures');

function lower(source: string, filename: string) {
  const parsed = parse(source, { filename });
  expect(parsed.ast).not.toBeNull();
  const { ir } = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() });
  expect(ir).not.toBeNull();
  return ir!;
}

function compileSolid(source: string, filename: string): string {
  return emitSolid(lower(source, filename), { filename, source }).code;
}

describe('Solid reserved-name deconfliction — <data> shadowing a solid-js import', () => {
  it('`<data children>` in a default-slot component renames to `children$local`, import intact', () => {
    const source = readFileSync(
      resolve(FIXTURES, 'SolidDataImportShadow.rozie'),
      'utf8',
    );
    const code = compileSolid(source, 'SolidDataImportShadow.rozie');

    // The default slot forces `import { children } from 'solid-js'` +
    // `const resolved = children(() => local.children)`.
    expect(code).toContain('children');
    expect(code).toContain('const resolved = children(');

    // FIX: the `<data> children` signal binding is renamed off the import.
    expect(code).toContain('const [children$local, setChildren$local] = createSignal');
    // The solid-js `children` import binding must NOT be shadowed by a second
    // top-level `const children = createSignal(...)`.
    expect(code).not.toMatch(/const \[children,\s*setChildren\]\s*=\s*createSignal/);
  });

  it('a `<data>` named `local` (emitter local) renames to `local$local`', () => {
    const source = `<rozie name="DataEmitterLocal">
<props>{ count: { type: Number, default: 0 } }</props>
<data>{ local: false }</data>
<script>
const toggle = () => { $data.local = !$data.local }
</script>
<template>
  <button @click="toggle">{{ $props.count }} {{ $data.local }}</button>
</template>
</rozie>`;
    const code = compileSolid(source, 'DataEmitterLocal.rozie');
    expect(code).toContain('const [local$local, setLocal$local] = createSignal');
    // The emitter-minted splitProps `local` binding must stay intact.
    expect(code).toContain('local');
    expect(code).not.toMatch(/const \[local,\s*setLocal\]\s*=\s*createSignal/);
  });

  it('a `<data> x` + `$computed x` sibling renames exactly one side', () => {
    const source = `<rozie name="DataComputedSibling">
<props>{ base: { type: Number, default: 1 } }</props>
<data>{ value: 2 }</data>
<script>
const value = $computed(() => $props.base * 10)
</script>
<template>
  <p>{{ $data.value }} {{ value }}</p>
</template>
</rozie>`;
    const code = compileSolid(source, 'DataComputedSibling.rozie');
    // Exactly one top-level `const value`/`const [value,...]` — the computed side
    // renames to `value$local`; the data getter keeps `value`.
    expect(code).toContain('const [value, setValue] = createSignal');
    expect(code).toContain('const value$local = createMemo');
    // No duplicate bare `const value = createMemo`.
    expect(code).not.toMatch(/const value = createMemo/);
  });

  it('`$expose({ value })` where `value` is a `$computed` renames the computed side IR-wide', () => {
    // Exposing a `$computed`-bound name is ROZ118 (a computed is a reactive VALUE,
    // not a function) — but Rozie collects-not-throws, so emission proceeds. Before
    // the fix the synthesized handle `{ value }` silently referenced the live memo
    // ACCESSOR; the shared `deconflictStateExposeCollision` (now walking
    // `ir.computed`) renames the computed binding to `value$local` so the IR no
    // longer silently maps the public verb onto the live memo getter.
    const source = `<rozie name="ExposeComputed">
<props>{ base: { type: Number, default: 1 } }</props>
<script>
const value = $computed(() => $props.base * 2)
$expose({ value })
</script>
<template>
  <p>{{ value }}</p>
</template>
</rozie>`;
    const ir = lower(source, 'ExposeComputed.rozie');
    // The IR computed name is renamed off the public verb.
    expect(ir.computed.map((c) => c.name)).toContain('value$local');
    // The `$expose` verb (public contract) is NOT renamed.
    expect(ir.expose.map((e) => e.name)).toContain('value');
    // The emitted memo binding uses the renamed name; the bare template read
    // `{{ value }}` follows the rename (no live memo accessor left under `value`).
    const code = emitSolid(ir, { filename: 'ExposeComputed.rozie', source }).code;
    expect(code).toContain('const value$local = createMemo');
    expect(code).not.toMatch(/const value = createMemo/);
  });

  it('a non-colliding `<data>`/`$computed` component is byte-identical (no rename)', () => {
    const source = `<rozie name="NoCollision">
<props>{ start: { type: Number, default: 0 } }</props>
<data>{ tally: 0 }</data>
<script>
const doubled = $computed(() => $props.start * 2)
const bump = () => { $data.tally += 1 }
</script>
<template>
  <button @click="bump">{{ $data.tally }} {{ doubled }}</button>
</template>
</rozie>`;
    const code = compileSolid(source, 'NoCollision.rozie');
    expect(code).not.toContain('$local');
    expect(code).toContain('const [tally, setTally] = createSignal');
    expect(code).toContain('const doubled = createMemo');
  });
});

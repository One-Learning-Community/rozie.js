/**
 * ANGULAR-STATE-NARROWING (SN-1 parity, quick 261019-ti9 add-on G) — an `r-if`
 * that tests a nullable component-level value (`$props`, a model prop, `$data`,
 * `$computed`) and re-reads it as a typed call argument or a member access must
 * pass `ngc` with `strictTemplates: true`.
 *
 * Unlike every other gate in this directory (plain `tsc --noEmit` over the
 * emitted CLASS only, which never sees the `template:` string), this one runs the
 * Angular compiler's template type-checker. It borrows `ngc` and the resolution
 * tree from the committed pagination-angular leaf (Angular 19, the supported
 * floor) so no dependency is added here.
 *
 * Pre-fix: Angular signal reads are calls (`picked()`), which TypeScript never
 * narrows, so `@if (picked()) { picked().name }` is TS2531 / TS2345 / TS2532 under
 * strictTemplates (15 errors on the witness). The emitter now asserts the tested
 * value non-null (`picked()!.name`) at the positions that need it, inside the
 * branch that tested it. The `!` is type-only (erased at compile time), so runtime
 * is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const LEAF = resolve(ROOT, 'packages/ui/pagination/packages/angular');

const WITNESS = `<rozie name="StateNarrow">
<types>
export interface Item { name: string; child: Item | null }
</types>
<props>
{
  label: { type: String, default: null },
  count: { type: Number },
  value: { type: String, model: true },
}
</props>
<data>
{
  picked: null as Item | null,
  maybe: undefined as Item | undefined,
}
</data>
<script lang="ts">
const sel = $computed((): Item | null => $data.picked)
const fmt = (s: string): string => s.toUpperCase()
const dbl = (n: number): number => n * 2
</script>
<template>
<div>
  <span r-if="$props.label"><slot name="labelSlot" :value="$props.label" :param-types="{ value: 'string' }"></slot></span>
  <span r-if="$props.label">{{ fmt($props.label) }} {{ $props.label.length }}</span>
  <span r-if="!!$props.label">{{ fmt($props.label) }}</span>
  <span r-if="$data.picked"><slot name="item" :item="$data.picked" :param-types="{ item: 'Item' }"></slot>{{ $data.picked.name }}</span>
  <span r-if="sel">{{ sel.name }}</span>
  <span r-if="$props.value">{{ fmt($props.value) }}</span>
  <span r-if="$props.count != null">{{ dbl($props.count) }}</span>
  <span r-if="$data.picked !== null">{{ $data.picked.name }}</span>
  <span r-if="$data.maybe !== undefined">{{ $data.maybe.name }}</span>
  <span r-if="null != $data.picked">{{ $data.picked.name }}</span>
  <span r-if="$data.picked"><b r-if="$data.picked.child">{{ $data.picked.child.name }}</b></span>
  <slot r-if="$props.label" name="bare" :value="$props.label" :param-types="{ value: 'string' }" />
  <span r-if="$props.label">{{ fmt($props.label) }}</span>
  <span r-else>none</span>
</div>
</template>
</rozie>`;

/** A NULLABLE model prop (default: null) re-read as a typed call argument. */
const MODEL = `<rozie name="ModelNarrow">
<props>
{
  value: { type: String, default: null, model: true },
}
</props>
<script lang="ts">
const fmt = (s: string): string => s.toUpperCase()
</script>
<template>
<div>
  <span r-if="$props.value">{{ fmt($props.value) }}</span>
  <span r-if="$model.value != null">{{ fmt($model.value) }}</span>
</div>
</template>
</rozie>`;

/** `ngc` with strictTemplates over one emitted component; returns the raw output ('' when clean). */
function ngcStrictTemplates(file: string, code: string): string {
  const ngc = join(LEAF, 'node_modules/.bin/ngc');
  if (!existsSync(ngc)) {
    throw new Error(`ngc not found at ${ngc} — install/build the workspace first.`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'rozie-angular-strict-templates-'));
  try {
    writeFileSync(join(dir, file), code);
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          strict: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          useDefineForClassFields: false,
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        angularCompilerOptions: {
          strictTemplates: true,
          strictInputAccessModifiers: true,
          strictNullInputTypes: true,
        },
        include: ['*.ts'],
      }),
    );
    copyFileSync(join(HERE, 'engine-modules.d.ts'), join(dir, 'engine-modules.d.ts'));
    symlinkSync(join(LEAF, 'node_modules'), join(dir, 'node_modules'), 'dir');
    try {
      execFileSync(ngc, ['-p', 'tsconfig.json'], { cwd: dir, stdio: 'pipe' });
      return '';
    } catch (err) {
      return (
        ((err as { stdout?: Buffer }).stdout?.toString() ?? '') +
        ((err as { stderr?: Buffer }).stderr?.toString() ?? '')
      ).replace(/\x1b\[[0-9;]*m/g, '');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('ANGULAR-STATE-NARROWING — a narrowed nullable component value feeds typed positions under strictTemplates', () => {
  for (const s of [
    { name: 'StateNarrow', src: WITNESS },
    { name: 'ModelNarrow', src: MODEL },
  ]) {
    it(`${s.name}: ngc strictTemplates is clean`, () => {
      const r = compile(s.src, { target: 'angular', filename: `${s.name}.rozie`, sourceMap: false });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const out = ngcStrictTemplates(`${s.name}.ts`, r.code);
      expect(out, out).toBe('');
    });
  }
});

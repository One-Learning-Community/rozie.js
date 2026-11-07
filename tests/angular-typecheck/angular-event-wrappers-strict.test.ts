/**
 * Template-called event wrappers under `ngc --strictTemplates`.
 *
 * Guarded (`.enter`), debounced, throttled and merged same-event handlers are hoisted to class
 * fields the template calls. They used to be `private`, which strict template type-checking
 * rejects (TS2341). The Angular CLI turns strict templates on by default, so an app compiling
 * `.rozie` source hit it; the leaves build with `strictTemplates: false` and never did.
 *
 * Also covers `.once` on a component event: the `RozieOnce` directive's template ref gates the
 * output binding, including inside `@for` and in a merged same-event method.
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

const CHILD = `<rozie name="Child">
<emits>{ ping: { payload: 'number' } }</emits>
<template><button @click="$emit('ping', 1)">x</button></template>
</rozie>`;

const PARENT = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<data>{ rows: [{ id: 1 }, { id: 2 }], n: 0 }</data>
<script lang="ts">
const hit = (v?: unknown) => { $data.n = $data.n + 1 }
</script>
<template>
<div>
  <input @keydown.enter="hit" @keydown.escape="hit" @input.debounce(50)="hit" @change.throttle(50)="hit" />
  <Child @ping.once="hit" />
  <Child @ping="hit" @ping.once="hit($event)" />
  <div r-for="row in $data.rows" :key="row.id"><Child @ping.once="hit(row)" /></div>
</div>
</template>
</rozie>`;

function ngcStrictTemplates(files: Record<string, string>): string {
  const ngc = join(LEAF, 'node_modules/.bin/ngc');
  if (!existsSync(ngc)) throw new Error(`ngc not found at ${ngc} — install/build the workspace first.`);
  const dir = mkdtempSync(join(tmpdir(), 'rozie-angular-event-wrappers-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(dir, name), code);
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'bundler',
          strict: true,
          noImplicitAny: false,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          useDefineForClassFields: false,
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
        angularCompilerOptions: { strictTemplates: true },
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

const emit = (name: string, src: string) => {
  const r = compile(src, { target: 'angular', filename: `${name}.rozie`, sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code;
};

describe('Angular template-called wrappers and component .once under strictTemplates', () => {
  it('ngc strictTemplates is clean', () => {
    const parent = emit('Parent', PARENT);
    expect(parent).toMatch(/protected _guarded/);
    expect(parent).toMatch(/protected debounced/);
    expect(parent).toMatch(/protected throttled/);
    expect(parent).toMatch(/protected _merged_/);
    expect(parent).toContain('rozieOnce #__rozieOnce');
    const out = ngcStrictTemplates({ 'Parent.ts': parent, 'Child.ts': emit('Child', CHILD) });
    expect(out, out).toBe('');
  });
});

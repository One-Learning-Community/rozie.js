/**
 * VUE-DIALOG-TYPED-SURFACE — the Vue half of the consumer-side typed-surface
 * gate (quick 261018-vdu). vue-tsc-checks compile(Dialog.rozie) under the strict
 * consumer tsconfig: the `close` payload is `DialogClosePayload`, the `open`
 * model's `update:open` is boolean, props are typed, and the handle verbs take no
 * arguments. Negatives are pinned to the specific vue-tsc message (no vacuous
 * passes).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/Dialog.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/internal/scrollLock.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/scrollLock'", "'./scrollLock'");

const OK = `<script setup lang="ts">
import { ref } from 'vue';
import Dialog, { type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './Dialog.vue';
const h = ref<DialogHandle | null>(null);
h.value?.show();
h.value?.hide();
const open = ref(false);
function onClose(p: DialogClosePayload) { const r: DialogCloseReason = p.reason; void r; }
</script>
<template>
  <Dialog
    ref="h"
    v-model:open="open"
    ariaLabel="x"
    ariaLabelledby="t"
    initialFocus="#a"
    :disableBackdropClose="true"
    class="c"
    @close="onClose"
    @update:open="(n) => { const b: boolean = n; void b; }"
  >
    <p>hi</p>
  </Dialog>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  {
    name: 'close payload reason is a DialogCloseReason, not a number',
    template: `<Dialog @close="(p) => p.reason.toExponential()" />`,
    match: /Property 'toExponential' does not exist on type 'DialogCloseReason'/,
  },
  {
    name: 'update:open payload is boolean',
    template: `<Dialog @update:open="(n) => n.toFixed()" />`,
    match: /Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'handle show() takes no arguments',
    script: `const h = ref<DialogHandle | null>(null);\nh.value?.show(1);`,
    template: `<Dialog ref="h" />`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'initialFocus rejects a number',
    template: `<Dialog :initialFocus="5" />`,
    match: /Type 'number' is not assignable to type/,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-dialog-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.consumer.strict.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(files)) writeFileSync(join(tmpDir, name), body, 'utf8');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/vue-tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
      return { ok: true, out: '' };
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      return { ok: false, out: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('VUE-DIALOG-TYPED-SURFACE — typed close payload, update:open boolean, typed handle', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'Dialog.rozie', sourceMap: false });
  const vue = flatten(r0.code);
  const files = (consumer: string) => ({ 'Dialog.vue': vue, 'scrollLock.ts': HELPER, 'Consumer.vue': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('strict typed consumer is clean', () => {
    const r = run(files(OK));
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport Dialog, { type DialogHandle } from './Dialog.vue';\nvoid ref; void Dialog;\nvoid (null as DialogHandle | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run(files(consumer));
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614/);
    });
  }

  it('barrel parity: Dialog and its public types are importable from the leaf barrel (src/index.ts)', () => {
    const barrel = readFileSync(resolve(ROOT, 'packages/ui/dialog/packages/vue/src/index.ts'), 'utf8');
    const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport { Dialog, type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './index';\nconst h = ref<DialogHandle | null>(null);\nh.value?.show();\nconst p: DialogClosePayload = { reason: 'escape' satisfies DialogCloseReason };\nvoid p;\n</script>\n<template>\n  <Dialog ref="h" />\n</template>\n`;
    const r = run({ ...files(consumer), 'index.ts': barrel });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });
});

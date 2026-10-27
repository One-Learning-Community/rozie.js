/**
 * VUE-TEXT-FIELD-TYPED-SURFACE — the Vue half of the consumer-side typed-surface
 * gate for `@rozie-ui/text-field` (mirrors dialog-typed-surface.test.ts).
 * vue-tsc-checks compile(TextField.rozie) under the strict consumer tsconfig:
 * the `change` / `enter` payloads are `TextFieldValuePayload`, the `modelValue`
 * model's `update:modelValue` is string, props are typed, and the exposed verbs
 * (focus / select / clear) take no arguments. Negatives are pinned to the
 * specific vue-tsc message (no vacuous passes).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/TextField.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/internal/autosize.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/autosize'", "'./autosize'");

const OK = `<script setup lang="ts">
import { ref } from 'vue';
import TextField, { type TextFieldValuePayload } from './TextField.vue';
const h = ref<InstanceType<typeof TextField> | null>(null);
h.value?.focus();
h.value?.select();
h.value?.clear();
const text = ref('');
const limit = ref<number | null>(null);
function onChange(p: TextFieldValuePayload) { const v: string = p.value; void v; }
function onEnter(p: TextFieldValuePayload) { const v: string = p.value; void v; }
</script>
<template>
  <TextField
    ref="h"
    v-model:modelValue="text"
    label="Email"
    description="d"
    error=""
    :invalid="true"
    type="email"
    placeholder="p"
    name="n"
    autocomplete="email"
    :required="true"
    :disabled="false"
    :readonly="false"
    :maxLength="limit"
    :showCount="true"
    :multiline="true"
    :autosize="true"
    :rows="3"
    :maxRows="8"
    ariaLabel="x"
    idBase="f"
    class="c"
    @change="onChange"
    @enter="onEnter"
    @update:modelValue="(n) => { const s: string = n; void s; }"
  >
    <template #prefix><span>$</span></template>
    <template #suffix><span>kg</span></template>
  </TextField>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  {
    name: 'change payload is a TextFieldValuePayload, not a string',
    template: `<TextField @change="(p) => p.toUpperCase()" />`,
    match: /Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/,
  },
  {
    name: 'enter payload value is a string',
    template: `<TextField @enter="(p) => p.value.toExponential()" />`,
    match: /Property 'toExponential' does not exist on type 'string'/,
  },
  {
    name: 'update:modelValue payload is string',
    template: `<TextField @update:modelValue="(n) => n.toExponential()" />`,
    match: /Property 'toExponential' does not exist on type 'string'/,
  },
  {
    name: 'exposed clear() takes no arguments',
    script: `const h = ref<InstanceType<typeof TextField> | null>(null);\nh.value?.clear(1);`,
    template: `<TextField ref="h" />`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'label rejects a number',
    template: `<TextField :label="5" />`,
    match: /Type 'number' is not assignable to type 'string'/,
  },
  {
    name: 'maxLength rejects a string',
    template: `<TextField :maxLength="'x'" />`,
    match: /Type 'string' is not assignable to type 'number'/,
  },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-text-field-'));
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

describe('VUE-TEXT-FIELD-TYPED-SURFACE — typed change/enter payload, update:modelValue string, typed exposed verbs', () => {
  const r0 = compile(SRC, { target: 'vue', filename: 'TextField.rozie', sourceMap: false });
  const vue = flatten(r0.code);
  const files = (consumer: string) => ({ 'TextField.vue': vue, 'autosize.ts': HELPER, 'Consumer.vue': consumer });

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
      const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport TextField, { type TextFieldValuePayload } from './TextField.vue';\nvoid ref; void TextField;\nvoid (null as TextFieldValuePayload | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run(files(consumer));
      expect(r.ok).toBe(false);
      expect(r.out).toMatch(neg.match);
      expect(r.out).not.toMatch(/TS2304|TS2614/);
    });
  }

  it('barrel parity: TextField and its public types are importable from the leaf barrel (src/index.ts)', () => {
    const barrel = readFileSync(resolve(ROOT, 'packages/ui/text-field/packages/vue/src/index.ts'), 'utf8');
    const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport { TextField, type TextFieldValuePayload } from './index';\nconst h = ref<InstanceType<typeof TextField> | null>(null);\nh.value?.focus();\nconst p: TextFieldValuePayload = { value: 'x' };\nvoid p;\n</script>\n<template>\n  <TextField ref="h" />\n</template>\n`;
    const r = run({ ...files(consumer), 'index.ts': barrel });
    expect(r.out).toBe('');
    expect(r.ok).toBe(true);
  });
});

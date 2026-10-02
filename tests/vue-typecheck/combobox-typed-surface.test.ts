/**
 * VUE-COMBOBOX-TYPED-SURFACE — typed public surface (release-0.8.0 token-input wave).
 * vue-tsc-checks compile(Combobox.rozie): `search` / `change` / `create` payloads
 * typed, every slot ctx typed, the token-input props accepted, handle verbs typed
 * (incl. `activeOption`). Negatives are pinned to the specific vue-tsc message.
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
// Absolute filename: the <components> Popover specifier resolves via node_modules UPWARD from it.
const SRC_PATH = resolve(ROOT, 'packages/ui/combobox/src/Combobox.rozie');
const SRC = readFileSync(SRC_PATH, 'utf8');

/** Stub the vendored runtime helper (not part of the combobox surface). */
function stubInternals(code: string): string {
  return code.replace(/^import \{ groupOptions \} from '\.\/internal\/groupOptions';$/m, 'const groupOptions: any = undefined;');
}

/**
 * Ambient shims for the composed popover leaf + windowing engine, which this
 * harness does not install (an import-preserving shim keeps the SFC/module
 * shape intact — replacing an import with a `const` would push the remaining
 * `<script setup>` imports out of module position).
 */
const SHIMS = `declare module '@rozie-ui/popover-vue' { const C: any; export default C; }
declare module '@rozie-ui/popover-svelte' { const C: any; export default C; }
declare module '@rozie-ui/popover-angular' { export const Popover: any; }
`;

/**
 * CONSUMER-surface gate: only diagnostics in the consumer file count. The
 * emitted combobox body carries pre-existing strict-mode body errors (implicit
 * any / never[] inference in r-for rows and block builders) that are not part of
 * the typed public surface (no cosmetic tsc on emitted bodies).
 */
function consumerErrors(out: string, file: string): string {
  return out.split('\n').filter((l) => l.includes(file) && /error/i.test(l)).join('\n');
}


const OK = `<script setup lang="ts">
import { ref } from 'vue';
import Combobox, { type ComboboxHandle, type ComboboxSearchPayload, type ComboboxChangePayload, type ComboboxCreatePayload, type ComboboxChipSlotCtx, type ComboboxOptionSlotCtx, type ComboboxQuerySlotCtx, type ComboboxGroupHeadingSlotCtx, type ComboboxGroupMoreSlotCtx, type ComboboxGroup } from './Combobox.vue';
const h = ref<ComboboxHandle | null>(null);
const to = ref<string[]>([]);
const picked: any = h.value?.activeOption();
h.value?.seedQuery('x');
h.value?.pinOpen(true);
void picked;
const isEmail = (text: string): boolean => text.includes('@');
declare const cp: ComboboxChangePayload; const cs: boolean = cp.selected; const ct: string | undefined = cp.text;
declare const sp: ComboboxSearchPayload; const sq: string = sp.query;
declare const crp: ComboboxCreatePayload; const crq: string = crp.query;
declare const chip: ComboboxChipSlotCtx; const chi: number = chip.index;
declare const oc: ComboboxOptionSlotCtx; const ob: boolean = oc.active && oc.selected && oc.disabled;
declare const qc: ComboboxQuerySlotCtx; const qq: string = qc.query;
declare const gh: ComboboxGroupHeadingSlotCtx; const g: ComboboxGroup = gh.group;
declare const gm: ComboboxGroupMoreSlotCtx; const gmh: number = gm.hidden;
void cs; void ct; void sq; void crq; void chi; void ob; void qq; void g; void gmh;
</script>
<template>
  <Combobox ref="h" v-model:value="to" multiple block chipLayout="inline" disableOpenOnFocus hideEmpty :delimiters="[',', ';']" :validate="isEmail" selectOnTab
    @search="(p) => { const q: string = p.query; void q; }"
    @change="(p) => { const s: boolean = p.selected; const t: string | undefined = p.text; void s; void t; }"
    @create="(p) => { const q: string = p.query; void q; }">
    <template #chip="{ option, remove, index }">{{ (index satisfies number) }}{{ void remove() }}{{ void option }}</template>
    <template #option="{ index, active, selected, disabled }">{{ (index satisfies number) }}{{ (active satisfies boolean) }}{{ (selected satisfies boolean) }}{{ (disabled satisfies boolean) }}</template>
    <template #empty="{ query }">{{ (query satisfies string) }}</template>
    <template #create="{ query }">{{ (query satisfies string) }}</template>
    <template #groupHeading="{ group }">{{ (group.id satisfies string) }}{{ (group.label satisfies string) }}</template>
    <template #groupMore="{ group, hidden, expand }">{{ (hidden satisfies number) }}{{ void expand() }}{{ group?.label }}</template>
  </Combobox>
</template>
`;

const NEGATIVES: Array<{ name: string; script?: string; template: string; match: RegExp }> = [
  { name: 'change payload selected is boolean', template: `<Combobox @change="(p) => p.selected.toUpperCase()" />`, match: /Property 'toUpperCase' does not exist on type 'boolean'/ },
  { name: 'search payload query is string', template: `<Combobox @search="(p) => p.query.toPrecision()" />`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  { name: 'change payload text is string | undefined', script: `declare const cp: ComboboxChangePayload;\nconst n: number = cp.text;\nvoid n;`, template: `<Combobox />`, match: /Type 'string \| undefined' is not assignable to type 'number'/ },
  { name: 'chip slot index is number', template: `<Combobox><template #chip="{ index }">{{ index.toUpperCase() }}</template></Combobox>`, match: /Property 'toUpperCase' does not exist on type 'number'/ },
  { name: 'handle seedQuery takes a string', script: `const h = ref<ComboboxHandle | null>(null);\nh.value?.seedQuery(1);`, template: `<Combobox ref="h" />`, match: /Argument of type 'number' is not assignable to parameter of type 'string'/ },
  { name: 'unknown handle verb rejected', script: `const h = ref<ComboboxHandle | null>(null);\nh.value?.openList();`, template: `<Combobox ref="h" />`, match: /Property 'openList' does not exist on type/ },
];

function run(files: Record<string, string>): { ok: boolean; out: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-combobox-'));
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

describe('VUE-COMBOBOX-TYPED-SURFACE — typed payloads, slot ctx, token-input props, typed handle', () => {
  const r0 = compile(SRC, { target: 'vue', filename: SRC_PATH, sourceMap: false });
  const vue = stubInternals(r0.code);

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('strict typed consumer is clean', () => {
    const r = run({ 'shims.d.ts': SHIMS, 'Combobox.vue': vue, 'Consumer.vue': OK });
    expect(consumerErrors(r.out, 'Consumer.vue'), r.out).toBe('');
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script setup lang="ts">\nimport { ref } from 'vue';\nimport Combobox, { type ComboboxHandle, type ComboboxChangePayload } from './Combobox.vue';\nvoid ref; void Combobox;\nvoid (null as ComboboxHandle | null); void (null as ComboboxChangePayload | null);\n${neg.script ?? ''}\n</script>\n<template>\n  ${neg.template}\n</template>\n`;
      const r = run({ 'shims.d.ts': SHIMS, 'Combobox.vue': vue, 'Consumer.vue': consumer });
      const mine = consumerErrors(r.out, 'Consumer.vue');
      expect(r.ok).toBe(false);
      expect(mine).toMatch(neg.match);
      expect(mine).not.toMatch(/TS2304|TS2614/);
    });
  }
});

// Phase 3 Plan 02 Task 2 — emitScript behavior + 3 file-snapshot fixtures
// (Counter/SearchInput/Modal). Per CONTEXT D-46 the per-block snapshots live
// at packages/targets/vue/fixtures/{Name}.script.snap and lock the emitter's
// script-side output verbatim.
//
// Behavior tests assert the 10 must-haves from the plan (Pattern 3 macro
// emission, Pitfall 3 defineModel exclusion, Pitfall 5 cross-scope cleanup,
// Pitfall 10 paired-identifier lifecycle).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';
import { emitVue } from '../emitVue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string): IRComponent {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — behavior', () => {
  it('Test 1: Counter contains defineModel<number>(\'value\', { default: 0 })', () => {
    const { script } = emitScript(lowerExample('Counter'));
    expect(script).toContain("defineModel<number>('value', { default: 0 })");
  });

  it('Test 2: Counter contains withDefaults(defineProps<{ step?, min?, max? }>) with -Infinity / Infinity literals', () => {
    const { script } = emitScript(lowerExample('Counter'));
    expect(script).toContain('withDefaults(');
    expect(script).toContain('defineProps<{ step?: number; min?: number; max?: number }>()');
    expect(script).toMatch(/step:\s*1/);
    expect(script).toContain('-Infinity');
    expect(script).toContain('Infinity');
  });

  it('Test 3: Counter contains const hovering = ref(false)', () => {
    const { script } = emitScript(lowerExample('Counter'));
    expect(script).toContain('const hovering = ref(false);');
  });

  it('Test 4: Counter contains computed() declarations for canIncrement/canDecrement', () => {
    const { script } = emitScript(lowerExample('Counter'));
    expect(script).toMatch(/const canIncrement\s*=\s*computed\(\(\)\s*=>/);
    expect(script).toMatch(/const canDecrement\s*=\s*computed\(\(\)\s*=>/);
    // Body uses rewritten value.value + props.step + props.max
    expect(script).toMatch(/value\.value\s*\+\s*props\.step\s*<=\s*props\.max/);
  });

  it('Test 5: Modal lockScroll/unlockScroll pair → onMounted(lockScroll); onBeforeUnmount(unlockScroll);', () => {
    const { script } = emitScript(lowerExample('Modal'));
    expect(script).toContain('onMounted(lockScroll);');
    expect(script).toContain('onBeforeUnmount(unlockScroll);');
  });

  it('Test 7: Counter import line is `import { computed, ref } from \'vue\';` (sorted)', () => {
    const { script } = emitScript(lowerExample('Counter'));
    // First non-empty line should be the import.
    const firstLine = script.split('\n').find((l) => l.trim().length > 0);
    expect(firstLine).toBe("import { computed, ref } from 'vue';");
  });

  it('Test 8: defineEmits emitted only when ir.emits non-empty (Counter has no emits)', () => {
    const counterScript = emitScript(lowerExample('Counter')).script;
    expect(counterScript).not.toContain('defineEmits');

    const searchInputScript = emitScript(lowerExample('SearchInput')).script;
    expect(searchInputScript).toContain('defineEmits<{');
    expect(searchInputScript).toMatch(/search:\s*\[/);
    expect(searchInputScript).toMatch(/clear:\s*\[/);
  });

  it('SearchInput contains `const query = ref(\'\')` (data → ref)', () => {
    const { script } = emitScript(lowerExample('SearchInput'));
    expect(script).toMatch(/const query = ref\(['"]['"]\);/);
  });

  it('SearchInput contains template-ref `const inputElRef = ref<HTMLInputElement>()`', () => {
    const { script } = emitScript(lowerExample('SearchInput'));
    expect(script).toMatch(/const inputElRef = ref<HTMLInputElement>\(\);/);
  });

  it('Modal $refs.dialogEl in $onMount arrow rewrites to dialogElRef.value?.focus()', () => {
    const { script } = emitScript(lowerExample('Modal'));
    expect(script).toMatch(/dialogElRef\.value\??\.focus/);
  });

  it('Counter emitVue() returns provisional SFC code with placeholder template/style', () => {
    const result = emitVue(lowerExample('Counter'));
    expect(result.code).toContain('<template>');
    expect(result.code).toContain('<script setup lang="ts">');
    expect(result.code).toContain('<style scoped>');
    expect(result.code).toContain('TODO Plan 03 templates');
    expect(result.code).toContain('TODO Plan 05 styles');
    expect(result.map).toBeNull();
  });
});

describe('emitScript — file snapshot fixtures (D-46)', () => {
  // Per RESEARCH.md Pitfall 8: anchor fixture path via fileURLToPath(import.meta.url).
  it('Counter.script.snap', async () => {
    const { script } = emitScript(lowerExample('Counter'));
    await expect(script).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.script.snap'));
  });

  it('SearchInput.script.snap', async () => {
    const { script } = emitScript(lowerExample('SearchInput'));
    await expect(script).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.script.snap'));
  });

  it('Modal.script.snap', async () => {
    const { script } = emitScript(lowerExample('Modal'));
    await expect(script).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.script.snap'));
  });
});

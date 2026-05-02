// Phase 3 Plan 05 Task 2 — 5 whole-SFC fixture snapshots locked.
//
// Each example .rozie compiles to a .vue.snap fixture; we also assert
// per-example substring invariants:
//   - Counter — basic shell
//   - SearchInput — Plan 03 debouncedOnSearch + runtime-vue import composes
//   - Dropdown — Plan 04 useOutsideClick + Plan 05 two `<style>` blocks
//     (success criterion 5: `</style>\n\n<style>` boundary)
//   - TodoList — emitScript-only (no listeners)
//   - Modal — defineSlots with scoped-slot params
//
// All 5 emitted SFCs must parse cleanly by @vue/compiler-sfc — smoke test
// that we emit valid Vue (asserts via parse() not throwing).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): { ir: IRComponent; src: string; filename: string } {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src, filename };
}

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('emitVue — 5 whole-SFC fixture snapshots locked', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name}.vue.snap`, async () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitVue(ir, { filename, source: src });
      await expect(code).toMatchFileSnapshot(resolve(FIXTURES, `${name}.vue.snap`));
    });
  }
});

describe('emitVue — success criterion 5: Dropdown has two <style> blocks', () => {
  it('Dropdown.vue.snap shows the literal `</style>\\n\\n<style>` boundary', () => {
    const { ir, src, filename } = loadExample('Dropdown');
    const { code } = emitVue(ir, { filename, source: src });
    // The boundary between scoped (first) and global (:root) blocks is the
    // success-criterion-5 anchor.
    expect(code).toMatch(/<\/style>\s*\n\s*<style>/);
    // Specifically: scoped block first, then global :root block.
    const styleBlocks = code.match(/<style[^>]*>/g) ?? [];
    expect(styleBlocks.length).toBe(2);
    expect(styleBlocks[0]).toBe('<style scoped>');
    expect(styleBlocks[1]).toBe('<style>');
  });

  it('Counter.vue.snap has exactly one <style scoped> block (no :root)', () => {
    const { ir, src, filename } = loadExample('Counter');
    const { code } = emitVue(ir, { filename, source: src });
    const styleBlocks = code.match(/<style[^>]*>/g) ?? [];
    expect(styleBlocks.length).toBe(1);
    expect(styleBlocks[0]).toBe('<style scoped>');
  });

  it('Modal.vue.snap has two <style> blocks (modal-z global var)', () => {
    const { ir, src, filename } = loadExample('Modal');
    const { code } = emitVue(ir, { filename, source: src });
    const styleBlocks = code.match(/<style[^>]*>/g) ?? [];
    expect(styleBlocks.length).toBe(2);
    expect(styleBlocks[0]).toBe('<style scoped>');
    expect(styleBlocks[1]).toBe('<style>');
  });
});

describe('emitVue — Dropdown.vue.snap substring invariants (Plan 04 + Plan 05 composition)', () => {
  it('Dropdown SFC has all critical pieces from Plans 02-05', () => {
    const { ir, src, filename } = loadExample('Dropdown');
    const { code } = emitVue(ir, { filename, source: src });

    // SFC envelope
    expect(code).toContain('<template>');
    expect(code).toContain('</template>');
    expect(code).toContain('<script setup lang="ts">');
    expect(code).toContain('</script>');

    // Plan 02 — defineModel for the model prop
    expect(code).toContain('defineModel');

    // Plan 04 — useOutsideClick from runtime-vue (D-42)
    expect(code).toContain('useOutsideClick');

    // Plan 05 — two style blocks
    expect(code).toContain('<style scoped>');
    expect(code).toContain('</style>\n\n<style>');
  });
});

describe('emitVue — @vue/compiler-sfc smoke test (every emitted .vue parses without errors)', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name} emitted SFC parses cleanly`, () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitVue(ir, { filename, source: src });
      const parsed = parseVueSFC(code);
      // @vue/compiler-sfc collects errors on `descriptor.errors` rather than
      // throwing — a clean parse means errors is empty.
      expect(parsed.errors, `${name}: ${JSON.stringify(parsed.errors)}`).toEqual([]);
      // Confirm the descriptor recovered all expected blocks.
      expect(parsed.descriptor.template).not.toBeNull();
      expect(parsed.descriptor.scriptSetup).not.toBeNull();
    });
  }
});

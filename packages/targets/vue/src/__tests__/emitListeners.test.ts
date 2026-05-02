// Phase 3 Plan 04 — emitListeners behavior + snapshot tests.
//
// emitListeners produces:
//   - Dropdown: 1 useOutsideClick(...) collapse (D-42), 1 watchEffect for
//     keydown.escape, 1 throttled-reposition wrap + watchEffect for resize
//   - SearchInput: empty (no <listeners>-block entries — only template events
//     which Plan 03 owns)
//   - TodoList: empty
//   - Counter: empty
//   - Modal: empty (also no <listeners>)
//
// Auto-collected `import { useOutsideClick, throttle } from '@rozie/runtime-vue';`
// imports only the helpers actually used (no `debounce` for Dropdown).
//
// Whole-script snapshots are owned here for SearchInput / Dropdown / TodoList —
// composing emitScript output (Plan 02) + scriptInjections from emitTemplate
// (Plan 03 — debounce wrap on SearchInput) + emitListeners output (Plan 04).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  Listener,
} from '../../../../core/src/ir/types.js';
import { emitListeners } from '../emit/emitListeners.js';
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

const LOC = { start: 0, end: 0 };

function emptyIR(): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Test',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    setupBody: { type: 'SetupBody', scriptProgram: t.file(t.program([])), annotations: [] },
    template: null,
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: LOC },
    sourceLoc: LOC,
  };
}

describe('emitListeners — Dropdown end-to-end', () => {
  const registry = createDefaultRegistry();
  const dropdown = lowerExample('Dropdown');

  it('Test 1: emits useOutsideClick(...) collapse with refs + whenSignal getter (D-42)', () => {
    const { code } = emitListeners(dropdown.listeners, dropdown, registry);
    expect(code).toContain('useOutsideClick(');
    expect(code).toContain('[triggerElRef, panelElRef]');
    expect(code).toContain('() => close()');
    expect(code).toMatch(/\(\) => open\.value && props\.closeOnOutsideClick/);
  });

  it('Test 2: emits watchEffect((onCleanup) => {...}) for keydown.escape with native key check + when gate', () => {
    const { code } = emitListeners(dropdown.listeners, dropdown, registry);
    expect(code).toContain('watchEffect((onCleanup) => {');
    expect(code).toContain('if (!(open.value && props.closeOnEscape)) return;');
    expect(code).toContain("if (e.key !== 'Escape') return;");
    expect(code).toContain("document.addEventListener('keydown'");
    expect(code).toContain("document.removeEventListener('keydown'");
  });

  it('Test 3: emits throttled-handler wrap + watchEffect for resize.throttle(100).passive', () => {
    const { code } = emitListeners(dropdown.listeners, dropdown, registry);
    expect(code).toContain('const throttledReposition = throttle(reposition, 100);');
    expect(code).toContain("window.addEventListener('resize', throttledReposition, { passive: true });");
    expect(code).toContain("window.removeEventListener('resize', throttledReposition");
  });

  it('Test 4: runtimeImports include useOutsideClick + throttle, NOT debounce (only collected helpers)', () => {
    const { runtimeImports } = emitListeners(dropdown.listeners, dropdown, registry);
    const set = runtimeImports.names();
    expect(set).toContain('useOutsideClick');
    expect(set).toContain('throttle');
    expect(set).not.toContain('debounce');
  });

  it('Test 5: vueImports.use(\'watchEffect\') is called for native-emit listeners', () => {
    const { vueImports } = emitListeners(dropdown.listeners, dropdown, registry);
    expect(vueImports.has('watchEffect')).toBe(true);
  });
});

describe('emitListeners — synthetic IR coverage', () => {
  const registry = createDefaultRegistry();

  it('Test 6: target=window emits window.addEventListener', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'global', name: 'window' },
      event: 'scroll',
      modifierPipeline: [],
      when: null,
      handler: parseExpression('() => onScroll()'),
      deps: [],
      source: 'listeners-block',
      sourceLoc: LOC,
    };
    const { code } = emitListeners([listener], ir, registry);
    expect(code).toContain("window.addEventListener('scroll'");
    expect(code).toContain("window.removeEventListener('scroll'");
  });

  it('Test 7: target=ref emits $refs-suffixed addEventListener', () => {
    const ir = emptyIR();
    ir.refs.push({
      type: 'RefDecl',
      name: 'triggerEl',
      elementTag: 'div',
      sourceLoc: LOC,
    });
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'ref', refName: 'triggerEl' },
      event: 'click',
      modifierPipeline: [],
      when: null,
      handler: parseExpression('handleClick'),
      deps: [],
      source: 'listeners-block',
      sourceLoc: LOC,
    };
    const { code } = emitListeners([listener], ir, registry);
    expect(code).toContain("triggerElRef.value?.addEventListener('click'");
    expect(code).toContain("triggerElRef.value?.removeEventListener('click'");
  });

  it('Test 8: zero-modifier listener with null when emits a simple watchEffect/onCleanup pair (no when guard)', () => {
    const ir = emptyIR();
    const listener: Listener = {
      type: 'Listener',
      target: { kind: 'global', name: 'document' },
      event: 'visibilitychange',
      modifierPipeline: [],
      when: null,
      handler: parseExpression('handleVisibility'),
      deps: [],
      source: 'listeners-block',
      sourceLoc: LOC,
    };
    const { code } = emitListeners([listener], ir, registry);
    expect(code).toContain('watchEffect((onCleanup) => {');
    // No `if (!(...)) return;` guard since when === null.
    expect(code).not.toMatch(/if \(!\(/);
    expect(code).toContain("document.addEventListener('visibilitychange'");
    expect(code).toContain('onCleanup(() =>');
  });

  it('Test 9: filters out listeners with source=\'template-event\' — only listeners-block entries are emitted', () => {
    const ir = emptyIR();
    const tmplListener: Listener = {
      type: 'Listener',
      target: { kind: 'self', el: '$el' },
      event: 'click',
      modifierPipeline: [],
      when: null,
      handler: parseExpression('handleClick'),
      deps: [],
      source: 'template-event',
      sourceLoc: LOC,
    };
    const { code } = emitListeners([tmplListener], ir, registry);
    expect(code).toBe('');
  });
});

describe('emitListeners — whole-script snapshot regen (Plan 04 ownership)', () => {
  it('Dropdown.script.snap composes emitScript + emitListeners output with runtime-vue imports', async () => {
    const ir = lowerExample('Dropdown');
    const { code } = emitVue(ir);
    // emitVue produces a full SFC. Extract the script body.
    const scriptMatch = code.match(/<script setup lang="ts">\n([\s\S]*?)\n<\/script>/);
    if (!scriptMatch || !scriptMatch[1])
      throw new Error('no <script setup> block in emitVue output');
    const scriptBody = scriptMatch[1];
    await expect(scriptBody).toMatchFileSnapshot(resolve(FIXTURES, 'Dropdown.script.snap'));
  });

  it('SearchInput.script.snap regenerated (no <listeners>-block; debounce wrap from Plan 03 still present)', async () => {
    const ir = lowerExample('SearchInput');
    const { code } = emitVue(ir);
    const scriptMatch = code.match(/<script setup lang="ts">\n([\s\S]*?)\n<\/script>/);
    if (!scriptMatch || !scriptMatch[1])
      throw new Error('no <script setup> block in emitVue output');
    const scriptBody = scriptMatch[1];
    await expect(scriptBody).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.script.snap'));
  });

  it('TodoList.script.snap regenerated (no listeners — composes Plan 02 emitScript only)', async () => {
    const ir = lowerExample('TodoList');
    const { code } = emitVue(ir);
    const scriptMatch = code.match(/<script setup lang="ts">\n([\s\S]*?)\n<\/script>/);
    if (!scriptMatch || !scriptMatch[1])
      throw new Error('no <script setup> block in emitVue output');
    const scriptBody = scriptMatch[1];
    await expect(scriptBody).toMatchFileSnapshot(resolve(FIXTURES, 'TodoList.script.snap'));
  });
});

describe('emitListeners — Dropdown.script.snap substring assertions (D-42 + Plan 03 slot-type composition)', () => {
  it('Dropdown SFC has all three listener emissions + runtime-vue imports', () => {
    const ir = lowerExample('Dropdown');
    const { code } = emitVue(ir);
    // Listener emissions (Plan 04):
    expect(code).toContain('useOutsideClick(');
    expect(code).toContain('watchEffect((onCleanup) => {');
    expect(code).toContain('throttle(reposition, 100)');
    // Auto-collected runtime-vue import (sorted, deduped):
    expect(code).toMatch(/import \{ throttle, useOutsideClick \} from '@rozie\/runtime-vue';/);
    // Plan 03 slot-type composition still intact (WARNING #1 ownership split):
    expect(code).toContain('trigger(props:');
  });
});

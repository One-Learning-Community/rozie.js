/**
 * Plan 04-03 Task 1+2+3 — emitTemplate behaviour tests.
 * Covers: className composition (D-53/D-54/D-55), clsx integration,
 * mustache-in-attribute, slot lowering, r-model, template @event.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import { emitReact } from '../emitReact.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function lowerExample(name: string): IRComponent {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return lowered.ir;
}

/**
 * Plan 04-05: snapshot tests pass source through so emitStyle wires the
 * `import styles from './X.module.css';` line at the top of each .tsx fixture.
 */
function lowerExampleWithSource(name: string): { ir: IRComponent; src: string } {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return { ir: lowered.ir, src };
}

function emit(ir: IRComponent) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const result = emitTemplate(ir, collectors, createDefaultRegistry());
  return { ...result, collectors };
}

describe('className composition — Plan 04-03 Task 1', () => {
  it('Test 8: single static class → className={styles.X}', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div class="counter"></div>
</template>
<style>
.counter { color: red; }
</style>
</rozie>
`);
    const { jsx, collectors } = emit(ir);
    expect(jsx).toContain('className={styles.counter}');
    expect(collectors.runtime.has('clsx')).toBe(false);
  });

  it('Test 9: multi static class → backtick template literal', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div class="counter card"></div>
</template>
<style>
.counter { color: red; }
.card { color: blue; }
</style>
</rozie>
`);
    const { jsx, collectors } = emit(ir);
    expect(jsx).toContain('className={`${styles.counter} ${styles.card}`}');
    expect(collectors.runtime.has('clsx')).toBe(false);
  });

  it('Test 10: object-form :class → clsx({ [styles.X]: cond }) and adds clsx import', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ active: false }</data>
<template>
<div :class="{ active: $data.active }"></div>
</template>
<style>
.active { color: red; }
</style>
</rozie>
`);
    const { jsx, collectors } = emit(ir);
    expect(jsx).toMatch(/clsx\(\{ \[styles\.active\]: active \}\)/);
    expect(collectors.runtime.has('clsx')).toBe(true);
  });

  it('Test 13: class + :class on same element → clsx merge', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ on: false }</data>
<template>
<div class="x" :class="{ on: $data.on }"></div>
</template>
<style>
.x { color: red; }
.on { color: green; }
</style>
</rozie>
`);
    const { jsx, collectors } = emit(ir);
    expect(jsx).toMatch(/className=\{clsx\(/);
    expect(jsx).toContain('styles.x');
    expect(jsx).toContain('[styles.on]: on');
    expect(collectors.runtime.has('clsx')).toBe(true);
  });

  it('class= without <style> block → emits plain string literal (no styles ref)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<button class="trigger-error">click</button>
</template>
</rozie>
`);
    const { jsx, collectors } = emit(ir);
    // Should NOT reference `styles` (would be a ReferenceError at runtime)
    expect(jsx).not.toMatch(/\bstyles\./);
    expect(jsx).not.toMatch(/\bstyles\[/);
    // Should emit the class as a plain string literal (either as a string attr
    // or wrapped in a JSX expression — both are valid React).
    expect(jsx).toMatch(/className=(?:"trigger-error"|\{"trigger-error"\})/);
    expect(collectors.runtime.has('clsx')).toBe(false);
  });

  it('Test 17: emitted code uses className= NOT class=', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div class="counter">
  <span class="value">x</span>
</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).not.toMatch(/\bclass=/);
    const matches = jsx.match(/className=/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Slot lowering — Plan 04-03 Task 2', () => {
  it('Test 1: default slot, no params → {props.children}', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot></slot></div>
</template>
</rozie>
`);
    const { jsx, slotPropFields } = emit(ir);
    expect(jsx).toContain('{props.children}');
    expect(slotPropFields.some((s) => /children\?: ReactNode/.test(s))).toBe(true);
  });

  it('Test 4: named slot, no params (Modal header) → {props.renderHeader}', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { jsx, slotPropFields } = emit(ir);
    expect(jsx).toContain('{props.renderHeader}');
    expect(slotPropFields.some((s) => /renderHeader\?: ReactNode/.test(s))).toBe(true);
  });

  it('Test 6: named slot with params (Dropdown trigger) → {props.renderTrigger?.(ctx)} + interface TriggerCtx', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const toggle = () => {}
</script>
<template>
<div><slot name="trigger" :open="$props.open" :toggle="toggle"></slot></div>
</template>
</rozie>
`);
    const { jsx, slotPropFields, slotCtxInterfaces } = emit(ir);
    expect(jsx).toContain('props.renderTrigger');
    expect(jsx).toMatch(/open: props\.open/);
    expect(jsx).toContain('toggle');
    expect(slotPropFields.some((s) => /renderTrigger\?:.*TriggerCtx.*ReactNode/.test(s))).toBe(true);
    expect(slotCtxInterfaces.some((s) => /interface TriggerCtx/.test(s))).toBe(true);
  });
});

describe('Whole-tsx fixture snapshots — Plan 04-03 Task 3 + Plan 04-05 CSS imports', () => {
  it('Counter.tsx snapshot', async () => {
    const { ir, src } = lowerExampleWithSource('Counter');
    const { code } = emitReact(ir, { filename: 'Counter.rozie', source: src });
    expect(code).toContain('className=');
    expect(code).not.toContain('return null;');
    expect(code).toContain('return (');
    // Plan 04-05: CSS Module sibling import emitted because Counter has scoped rules.
    expect(code).toContain("import styles from './Counter.module.css';");
    // Counter has NO :root → no global CSS sibling import.
    expect(code).not.toContain("import './Counter.global.css';");
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.tsx.snap'));
  });

  it('SearchInput.tsx snapshot', async () => {
    const { ir, src } = lowerExampleWithSource('SearchInput');
    const { code } = emitReact(ir, { filename: 'SearchInput.rozie', source: src });
    expect(code).toContain('value={query}');
    expect(code).toContain('onChange=');
    expect(code).toContain("import styles from './SearchInput.module.css';");
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.tsx.snap'));
  });

  it('Dropdown.tsx snapshot — REACT-T-04 / REACT-T-07 anchor', async () => {
    const { ir, src } = lowerExampleWithSource('Dropdown');
    const { code } = emitReact(ir, { filename: 'Dropdown.rozie', source: src });
    expect(code).toContain('renderTrigger');
    // Plan 04-05: Dropdown has both scoped rules AND :root rules → both imports.
    expect(code).toContain("import styles from './Dropdown.module.css';");
    expect(code).toContain("import './Dropdown.global.css';");
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Dropdown.tsx.snap'));
  });

  it('TodoList.tsx snapshot — items.map + slot-with-params anchor', async () => {
    const { ir, src } = lowerExampleWithSource('TodoList');
    const { code } = emitReact(ir, { filename: 'TodoList.rozie', source: src });
    expect(code).toMatch(/\.map\(/);
    expect(code).toContain("import styles from './TodoList.module.css';");
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TodoList.tsx.snap'));
  });

  it('Modal.tsx snapshot', async () => {
    const { ir, src } = lowerExampleWithSource('Modal');
    const { code } = emitReact(ir, { filename: 'Modal.rozie', source: src });
    // Plan 04-05: Modal has both scoped rules AND :root rules → both imports.
    expect(code).toContain("import styles from './Modal.module.css';");
    expect(code).toContain("import './Modal.global.css';");
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.tsx.snap'));
  });
});

describe('JSX-skeleton fixture snapshots (diff isolation) — Plan 04-03 Task 3', () => {
  it.each(['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'])(
    '%s.jsx-skeleton.snap',
    async (name) => {
      const ir = lowerExample(name);
      const { jsx } = emit(ir);
      await expect(jsx).toMatchFileSnapshot(resolve(FIXTURES, `${name}.jsx-skeleton.snap`));
    },
  );
});

describe('SlotDecl IR shape — Phase 4 finalization gate', () => {
  it('SlotDecl shape unchanged (D-18 sufficient)', () => {
    const irTypesPath = resolve(REPO_ROOT, 'packages/core/src/ir/types.ts');
    const src = readFileSync(irTypesPath, 'utf8');
    expect(src).toContain('export interface SlotDecl');
    expect(src).toMatch(/params: ParamDecl\[\]/);
    expect(src).toMatch(/presence: 'always' \| 'conditional'/);
    expect(src).toMatch(/nestedSlots: SlotDecl\[\]/);
  });
});

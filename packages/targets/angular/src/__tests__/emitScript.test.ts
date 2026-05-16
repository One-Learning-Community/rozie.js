/**
 * emitScript test — Phase 5 Plan 05-04a Task 1.
 *
 * Behavior tests on the script-side emitter for Angular standalone components.
 * Drives the per-block fixture snapshots Counter.script.snap, SearchInput.script.snap,
 * and Modal.script.snap.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadIR(name: string): IRComponent {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — Counter signal mapping', () => {
  it('Counter $props with model:true emits model<number>(0)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('value = model<number>(0)');
  });

  it('Counter $data emits hovering = signal(false)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('hovering = signal(false)');
  });

  it('Counter $computed emits canIncrement = computed(() => ...)', () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toMatch(/canIncrement = computed\(\(\) =>/);
    expect(classBody).toMatch(/canDecrement = computed\(\(\) =>/);
    // Should reference this.value() etc.
    expect(classBody).toMatch(/this\.value\(\)/);
  });

  it("Counter constructor body contains console.log('hello from rozie') verbatim (DX-03)", () => {
    const ir = loadIR('Counter');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('console.log("hello from rozie")');
  });

  it('Counter has no slot interfaces (no slots)', () => {
    const ir = loadIR('Counter');
    const { interfaceDecls } = emitScript(ir);
    expect(interfaceDecls).toEqual([]);
  });

  it('Counter imports do NOT include FormsModule', () => {
    const ir = loadIR('Counter');
    const { imports } = emitScript(ir);
    expect(imports.hasForms('FormsModule')).toBe(false);
  });
});

describe('emitScript — Modal D-19 paired-cleanup', () => {
  it('Modal emits multiple inject(DestroyRef).onDestroy(...) calls in source order', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    // D-19 paired pair: lockScroll mounted with unlockScroll cleanup.
    expect(classBody).toContain('inject(DestroyRef).onDestroy(this.unlockScroll)');
  });

  it('Modal class body has inject(DestroyRef) ONLY in constructor (Pitfall 8)', () => {
    const ir = loadIR('Modal');
    const { classBody } = emitScript(ir);
    // Find each occurrence of `inject(` and verify it is INSIDE constructor block.
    const constructorMatch = classBody.match(/constructor\(\) \{([\s\S]*?)\n\}/);
    expect(constructorMatch).not.toBeNull();
    const constructorBody = constructorMatch![1]!;
    // Count inject() occurrences in constructor and globally.
    const totalInjects = (classBody.match(/inject\(/g) ?? []).length;
    const constructorInjects = (constructorBody.match(/inject\(/g) ?? []).length;
    expect(constructorInjects).toBe(totalInjects);
    expect(totalInjects).toBeGreaterThanOrEqual(1);
  });
});

describe('emitScript — SearchInput debounce + cleanup-return', () => {
  it('SearchInput inputEl ref emits viewChild<ElementRef<HTMLInputElement>>', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain("inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl')");
  });

  it('SearchInput onMount-with-cleanup-return emits inject(DestroyRef).onDestroy(...)', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('inject(DestroyRef).onDestroy(');
  });

  it('SearchInput emits output() for both `search` and `clear` events', () => {
    const ir = loadIR('SearchInput');
    const { classBody } = emitScript(ir);
    // `search` carries a payload (`$emit('search', query)`) → output<unknown>().
    expect(classBody).toContain('search = output<unknown>()');
    // `clear` is payload-less (`$emit('clear')`) → output<void>() so a
    // no-arg `.emit()` typechecks (bug 4).
    expect(classBody).toContain('clear = output<void>()');
  });
});

describe('emitScript — TodoList slot context interfaces', () => {
  it('TodoList emits interface HeaderCtx and DefaultCtx and EmptyCtx', () => {
    const ir = loadIR('TodoList');
    const { interfaceDecls } = emitScript(ir);
    const joined = interfaceDecls.join('\n');
    expect(joined).toContain('interface HeaderCtx');
    expect(joined).toContain('interface DefaultCtx');
    expect(joined).toContain('interface EmptyCtx');
  });

  it('TodoList class body emits @ContentChild fields with synthetic #defaultSlot ref name', () => {
    const ir = loadIR('TodoList');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain("@ContentChild('header'");
    expect(classBody).toContain("@ContentChild('defaultSlot'");
    expect(classBody).toContain("@ContentChild('empty'");
  });

  it('TodoList class has ngTemplateContextGuard static method', () => {
    const ir = loadIR('TodoList');
    const { classBody } = emitScript(ir);
    expect(classBody).toContain('static ngTemplateContextGuard');
  });
});

describe('emitScript — per-block snapshot fixtures', () => {
  it('Counter.script.snap', async () => {
    const ir = loadIR('Counter');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.script.snap'));
  });

  it('SearchInput.script.snap', async () => {
    const ir = loadIR('SearchInput');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.script.snap'));
  });

  it('Modal.script.snap', async () => {
    const ir = loadIR('Modal');
    const { classBody, interfaceDecls, imports } = emitScript(ir);
    const out = [
      imports.render(),
      interfaceDecls.join('\n\n'),
      classBody,
    ]
      .filter((s) => s.trim().length > 0)
      .join('\n\n');
    await expect(out).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.script.snap'));
  });
});

describe('emitScript — Quick 260515-u2b $watch lowering', () => {
  function lowerSrc(src: string): IRComponent {
    const parsed = parse(src, { filename: 'Synth.rozie' });
    return lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
  }

  it('emits `effect(() => { (getter)(); (cb)(); });` inside the constructor for one WatchHook', () => {
    const src = `<rozie name="Synth">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
$watch(() => $props.open, () => { console.log('fired') })
</script>
<template><div /></template>
</rozie>`;
    const ir = lowerSrc(src);
    const { classBody, imports } = emitScript(ir);
    // Angular rewrite: $props.open → this.open (signal-style member access via this.open()).
    // The effect() wrapper plus IIFE shape should be present.
    expect(classBody).toMatch(/effect\(\(\) => \{ \([\s\S]+?\)\(\); \([\s\S]+?\)\(\); \}\);/);
    expect(imports.has('effect')).toBe(true);
  });

  it('emits no effect() call AND no `effect` import when there are zero watchers AND no $onUpdate', () => {
    // Counter has no $onUpdate and no $watch — `effect` should NOT be in imports.
    const ir = loadIR('Counter');
    const { imports } = emitScript(ir);
    expect(imports.has('effect')).toBe(false);
  });
});

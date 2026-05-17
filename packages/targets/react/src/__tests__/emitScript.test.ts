// Plan 04-02 Task 2 — emitScript + emitPropsInterface + emitReact behavior +
// 3 whole-tsx file-snapshot fixtures (Counter, SearchInput, Modal).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';
import { emitPropsInterface } from '../emit/emitPropsInterface.js';
import { emitReactTypes } from '../emit/emitTypes.js';
import { emitScript } from '../emit/emitScript.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function lowerExample(name: string): IRComponent {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitScript — behavior', () => {
  it('Test 4: Counter produces useControllableState (model:value), useState (hovering), useMemo×2 (canIncrement/canDecrement)', () => {
    const ir = lowerExample('Counter');
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const { hookSection } = emitScript(ir, collectors);

    expect(hookSection).toMatch(/useControllableState\s*\(\s*\{/);
    expect(hookSection).toMatch(/value:\s*props\.value/);
    expect(hookSection).toMatch(/defaultValue:\s*props\.defaultValue\s*\?\?\s*0/);
    expect(hookSection).toMatch(/onValueChange:\s*props\.onValueChange/);

    // useState for hovering
    expect(hookSection).toMatch(/const\s*\[\s*hovering\s*,\s*setHovering\s*\]\s*=\s*useState\(\s*false\s*\)/);

    // useMemo for canIncrement/canDecrement
    expect(hookSection).toMatch(/const canIncrement\s*=\s*useMemo\(/);
    expect(hookSection).toMatch(/const canDecrement\s*=\s*useMemo\(/);

    // Imports collected
    expect(collectors.react.has('useState')).toBe(true);
    expect(collectors.react.has('useMemo')).toBe(true);
    expect(collectors.runtime.has('useControllableState')).toBe(true);
  });

  it('Test 5: Modal paired LifecycleHook (lockScroll, unlockScroll) → ONE useEffect with cleanup return + savedBodyOverflow useRef hoist', () => {
    const ir = lowerExample('Modal');
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const { hookSection, lifecycleEffectsSection } = emitScript(ir, collectors);

    // Module-let auto-hoisted to useRef('') — still in hookSection
    expect(hookSection).toMatch(/const savedBodyOverflow\s*=\s*useRef\(\s*['"]['"]\s*\)/);

    // Plan 04-04: lifecycle useEffects moved out of hookSection into
    // lifecycleEffectsSection (placed AFTER user arrows by emitReact) so
    // const-arrow / useCallback helpers from userArrowsSection are in scope
    // when the dep array literal evaluates. Eliminates Plan 04-03 deferred
    // TDZ limitation #1.
    const useEffectMatches = lifecycleEffectsSection.match(/useEffect\(/g) ?? [];
    expect(useEffectMatches.length).toBeGreaterThanOrEqual(1);
    // Modal has 2 lifecycle hooks: paired (lockScroll, unlockScroll) and
    // standalone $onMount(arrow with $refs.dialogEl?.focus()).
    expect(useEffectMatches.length).toBe(2);

    // Cleanup is wired via `return () => unlockScroll();` inside the paired useEffect
    expect(lifecycleEffectsSection).toMatch(/return\s*\(\s*\)\s*=>\s*unlockScroll\(\)/);

    expect(collectors.react.has('useRef')).toBe(true);
    expect(collectors.react.has('useEffect')).toBe(true);
  });

  it('Quick 260515-u2b — WatchHook emits useEffect(cb, deps); deps union getter body deps + callback closure refs to satisfy react-hooks/exhaustive-deps (D-62)', () => {
    const src = `<rozie name="WatchOne">
<props>{ open: { type: Boolean, default: false }, closeOnEscape: { type: Boolean, default: true } }</props>
<script>
const reposition = () => { console.log('repos') }
$watch(() => $props.open, () => { if ($props.closeOnEscape) reposition() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchOne.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const { lifecycleEffectsSection } = emitScript(ir, collectors);
    // Dep array MUST include props.open (getter body) — that's the watch trigger.
    // Dep array MUST also include `reposition` (closure ref read in callback body)
    // because react-hooks/exhaustive-deps requires every identifier read inside
    // the useEffect callback to appear in the deps. We union getterDeps with
    // computeHelperBodyDeps(callback) — that picks up both closure helpers AND
    // any reactive refs read in the callback body (e.g., props.closeOnEscape).
    // The cost: we lose the "getter-only" semantic purity, but the lint gate
    // (D-62 no-eslint-disable floor) hard-requires this union.
    expect(lifecycleEffectsSection).toMatch(/useEffect\([\s\S]*?\bprops\.open\b/);
    expect(lifecycleEffectsSection).toMatch(/useEffect\([\s\S]*?\breposition\b/);
    expect(collectors.react.has('useEffect')).toBe(true);
  });

  it('Quick 260515-u2b — WatchHook callback body is INLINED into the useEffect callback; deps include both fire (closure) and props.open (getter)', () => {
    const src = `<rozie name="WatchInlined">
<props>{ open: { type: Boolean, default: false } }</props>
<script>
const fire = () => { console.log('fired') }
$watch(() => $props.open, () => { fire() })
</script>
<template><div /></template>
</rozie>`;
    const parsed = parse(src, { filename: 'WatchInlined.rozie' });
    const ir = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() }).ir!;
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const { lifecycleEffectsSection } = emitScript(ir, collectors);
    // Callback body is inlined; deps array sorted alphabetically.
    expect(lifecycleEffectsSection).toMatch(/useEffect\(\(\) => \{\s*fire\(\);\s*\}, \[fire, props\.open\]\);/);
  });

  it('Quick 260515-u2b — Counter (no watchers) emits no extra useEffect; existing fixtures untouched', () => {
    const ir = lowerExample('Counter');
    const collectors = {
      react: new ReactImportCollector(),
      runtime: new RuntimeReactImportCollector(),
    };
    const { lifecycleEffectsSection } = emitScript(ir, collectors);
    // Counter has zero lifecycle + zero watchers, so the section should be empty.
    expect(lifecycleEffectsSection.trim()).toBe('');
  });
});

describe('emitPropsInterface — behavior', () => {
  it('Test 6: Counter emits 6-field interface CounterProps (model:value synthesizes 3 fields per D-31/D-56)', () => {
    const ir = lowerExample('Counter');
    const ifaceText = emitPropsInterface(ir);
    expect(ifaceText).toContain('interface CounterProps');
    expect(ifaceText).toMatch(/value\?:\s*number/);
    expect(ifaceText).toMatch(/defaultValue\?:\s*number/);
    expect(ifaceText).toMatch(/onValueChange\?:\s*\(value:\s*number\)\s*=>\s*void/);
    expect(ifaceText).toMatch(/step\?:\s*number/);
    expect(ifaceText).toMatch(/min\?:\s*number/);
    expect(ifaceText).toMatch(/max\?:\s*number/);
  });
});

describe('emitReact — whole-tsx fixture snapshots', () => {
  function readExampleSource(name: string): string {
    return readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  }

  it('Test 7: Counter.tsx — REACT-T-01 + REACT-T-03 + REACT-T-07 anchor', async () => {
    const ir = lowerExample('Counter');
    const source = readExampleSource('Counter');
    const { code, diagnostics } = emitReact(ir, { filename: 'Counter.rozie', source });
    // Sanity: NO `import React from 'react'` (D-68 automatic JSX runtime)
    expect(code).not.toContain("import React from 'react'");
    expect(code).toContain("from 'react'");
    expect(code).toContain('useControllableState');
    expect(code).toContain('interface CounterProps');
    // No emit-time diagnostics for Counter
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.tsx.snap'));
  });

  it('Test 8: Modal.tsx — REACT-T-06 + Pitfall 3 module-let auto-hoist anchor', async () => {
    const ir = lowerExample('Modal');
    const source = readExampleSource('Modal');
    const { code, diagnostics } = emitReact(ir, { filename: 'Modal.rozie', source });
    expect(code).not.toContain("import React from 'react'");
    expect(code).toContain('savedBodyOverflow.current');
    expect(code).toContain('const savedBodyOverflow = useRef');
    // ROZ522 warning emitted as advisory
    const roz522 = diagnostics.find((d) => d.code === 'ROZ522');
    expect(roz522).toBeDefined();

    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.tsx.snap'));
  });

  it('SearchInput.tsx fixture', async () => {
    const ir = lowerExample('SearchInput');
    const source = readExampleSource('SearchInput');
    const { code } = emitReact(ir, { filename: 'SearchInput.rozie', source });
    expect(code).not.toContain("import React from 'react'");
    expect(code).toContain('interface SearchInputProps');
    expect(code).toContain('useState');
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.tsx.snap'));
  });
});

// Phase 07.3.2-01 — D-SV-16 cross-target port. Producer-side intake of the
// consumer's dynamic-name slots map at emitSlotFiller.ts:140 (`slots={{
// [expr]: (ctx) => (<>...</>) }}`) and per-slot merge `(props.renderX ??
// props.slots?.['x'])` at every slot invocation. D-02 static-wins, D-05
// non-slotted components stay byte-equivalent (Counter has no slots field).
describe('emitPropsInterface / emitReactTypes — §slots-merge intake (Phase 07.3.2 D-SV-16 port)', () => {
  it('Modal (slotted) inline Props interface contains slots?: Record<string, () => import(\'react\').ReactNode>', () => {
    const ir = lowerExample('Modal');
    const ifaceText = emitPropsInterface(ir);
    expect(ifaceText).toContain('interface ModalProps');
    // Phase 07.3.2 Plan 07 (CR-01) — zero-args form matches the no-params
    // named-slot invocation `?.()` at emitSlotInvocation.ts:302. Prior Plan 01
    // wrote `(ctx: any) =>` which contradicts the call site and crashes
    // consumers who destructure ctx.
    expect(ifaceText).toMatch(/slots\?:\s*Record<string,\s*\(\)\s*=>\s*import\('react'\)\.ReactNode>/);
    expect(ifaceText).not.toContain('(ctx: any) =>');
  });

  it('Modal (slotted) public .d.ts contains slots?: Record<string, () => ReactNode>', () => {
    const ir = lowerExample('Modal');
    const dtsText = emitReactTypes(ir);
    expect(dtsText).toContain('export interface ModalProps');
    // .d.ts uses bare ReactNode (already imported at file top) — NOT
    // import('react').ReactNode — contrast with inline Props interface.
    expect(dtsText).toMatch(/slots\?:\s*Record<string,\s*\(\)\s*=>\s*ReactNode>/);
    // Ensure the .d.ts side does NOT use the import('react') verbose form.
    expect(dtsText).not.toMatch(/slots\?:\s*Record<string,\s*\(\)\s*=>\s*import\('react'\)\.ReactNode>/);
    // Phase 07.3.2 Plan 07 (CR-01) — old one-arg form must be gone.
    expect(dtsText).not.toContain('(ctx: any) =>');
  });

  it('Counter (non-slotted) emits NO slots?: field in inline Props interface (D-05 byte-equivalence)', () => {
    const ir = lowerExample('Counter');
    const ifaceText = emitPropsInterface(ir);
    expect(ifaceText).not.toMatch(/slots\?:\s*Record/);
  });

  it('Counter (non-slotted) emits NO slots?: field in public .d.ts (D-05 byte-equivalence)', () => {
    const ir = lowerExample('Counter');
    const dtsText = emitReactTypes(ir);
    expect(dtsText).not.toMatch(/slots\?:\s*Record/);
  });
});

// Phase 07.3.2-07 — CR-01 fix from REVIEW.md. The dynamic-slots map value
// type MUST match the no-params named-slot invocation form at
// emitSlotInvocation.ts:302 (`?.()`, zero args). Plan 01 wrote `(ctx: any)
// =>` (one arg); Plan 04 wired the call site as zero-args. A consumer-
// supplied `slots={{ brand: (ctx) => ctx.x }}` crashes at runtime because
// `ctx === undefined`. This block locks the contract so future drift is a
// snapshot-layer failure rather than a runtime regression.
describe('emitPropsInterface / emitReactTypes — §slots-merge-cr01 value type matches no-args invocation form', () => {
  it('emitPropsInterface(slottedIr) emits the zero-args form on the inline TSX Props interface', () => {
    const ir = lowerExample('Modal');
    const out = emitPropsInterface(ir);
    expect(out).toContain("slots?: Record<string, () => import('react').ReactNode>");
    expect(out).not.toContain('(ctx: any) =>');
  });

  it('emitReactTypes(slottedIr) emits the zero-args form on the public .d.ts and brings ReactNode into scope', () => {
    const ir = lowerExample('Modal');
    const out = emitReactTypes(ir);
    expect(out).toContain('slots?: Record<string, () => ReactNode>');
    expect(out).not.toContain('(ctx: any) =>');
    expect(out).toContain("import type { ReactNode } from 'react';");
  });

  it('emitPropsInterface(nonSlottedIr) does NOT emit any slots?: field (Counter — D-05 byte-equivalence)', () => {
    const ir = lowerExample('Counter');
    const out = emitPropsInterface(ir);
    expect(out).not.toMatch(/slots\?:/);
  });

  it('contract symmetry: BOTH emitters declare the slots map as `() =>` (no args) for the same IR (Pitfall 1 lock)', () => {
    const ir = lowerExample('Modal');
    const ifaceText = emitPropsInterface(ir);
    const dtsText = emitReactTypes(ir);
    const ifaceSlotLine = ifaceText.split('\n').find((l) => l.includes('slots?:')) ?? '';
    const dtsSlotLine = dtsText.split('\n').find((l) => l.includes('slots?:')) ?? '';
    expect(ifaceSlotLine).not.toBe('');
    expect(dtsSlotLine).not.toBe('');
    expect(ifaceSlotLine).toContain('() =>');
    expect(dtsSlotLine).toContain('() =>');
    expect(ifaceSlotLine).not.toContain('(ctx:');
    expect(dtsSlotLine).not.toContain('(ctx:');
  });
});

describe('emitSlotInvocation — §slots-merge invocation (Phase 07.3.2 D-02 static-wins)', () => {
  it('header-slot invocation merges (props.renderHeader ?? props.slots?.[\'header\']) at invocation site', () => {
    // Whole-Modal emit ensures the merged fieldRef expression appears at every
    // invocation site. D-02 static-wins: static prop LEFT of `??`, dynamic
    // slots map RIGHT.
    const ir = lowerExample('Modal');
    const source = readFileSync(resolve(EXAMPLES, 'Modal.rozie'), 'utf8');
    const { code } = emitReact(ir, { filename: 'Modal.rozie', source });
    // Modal declares header + default + footer slots.
    expect(code).toContain("(props.renderHeader ?? props.slots?.['header'])");
    expect(code).toContain("(props.renderFooter ?? props.slots?.['footer'])");
  });

  it('default-slot invocation uses empty-string sentinel: (props.children ?? props.slots?.[\'\']) (D-18 invariant)', () => {
    const ir = lowerExample('Modal');
    const source = readFileSync(resolve(EXAMPLES, 'Modal.rozie'), 'utf8');
    const { code } = emitReact(ir, { filename: 'Modal.rozie', source });
    // D-18 empty-string sentinel for default slot key in the dynamic slots map.
    expect(code).toContain("(props.children ?? props.slots?.[''])");
  });
});

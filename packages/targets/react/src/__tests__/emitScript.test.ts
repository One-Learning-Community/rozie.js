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

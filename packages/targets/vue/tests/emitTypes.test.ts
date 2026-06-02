/**
 * Phase 22 Plan 22-03 Task 1 — emitVueTypes behaviour tests.
 *
 * The Vue `.d.rozie.ts` renderer consumes the core-shared `renderPropsInterface`
 * (Plan 22-02 LOCKED CONTRACT) for the props body and swaps ONLY the default
 * export to Vue's `DefineComponent<<Name>Props>` idiom (PATTERNS Pattern 2).
 *
 * Test 1: Counter (model:true) emits the shared `<Name>Props` body (same prop
 *         lines as React) + the Vue default-export line.
 * Test 2: Dropdown ($expose) emits `export interface DropdownHandle { ... }`
 *         with the exposed method members + a DefineComponent default export.
 * Test 3: empty ir.expose emits NO handle interface.
 * Test 4: default export is `DefineComponent<CounterProps>`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitVueTypes } from '../src/emit/emitTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function load(name: string): IRComponent {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return lowered.ir;
}

describe('emitVueTypes — Phase 22 Plan 22-03', () => {
  it('Test 1: Counter — shared props body (model triplet) + Vue default export', () => {
    const out = emitVueTypes(load('Counter'));
    // Header is the Vue import (NOT the React ReactNode import).
    expect(out.startsWith(`import type { DefineComponent } from 'vue';`)).toBe(
      true,
    );
    expect(out).toContain(`export interface CounterProps {`);
    // The shared renderer produces the SAME model-triplet lines as React.
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
    expect(out).toContain(`step?: number;`);
    // Vue default export idiom.
    expect(out).toContain(`declare const Counter: DefineComponent<CounterProps>;`);
    expect(out).toContain(`export default Counter;`);
  });

  it('Test 2: Dropdown ($expose) — exported handle interface + default export', () => {
    const out = emitVueTypes(load('Dropdown'));
    expect(out).toContain(`export interface DropdownHandle {`);
    // Exposed methods are members of the handle interface.
    expect(out).toMatch(/\btoggle:/);
    expect(out).toMatch(/\bclose:/);
    expect(out).toContain(`declare const Dropdown: DefineComponent<DropdownProps>;`);
  });

  it('Test 3: empty ir.expose — NO handle interface', () => {
    const ir = load('Counter');
    expect((ir.expose ?? []).length).toBe(0);
    const out = emitVueTypes(ir);
    expect(out).not.toContain('Handle {');
    expect(out).not.toContain('CounterHandle');
  });

  it('Test 4: default export idiom is DefineComponent<CounterProps>', () => {
    const out = emitVueTypes(load('Counter'));
    expect(out).toContain(`DefineComponent<CounterProps>`);
    // It is NOT the React forwardRef / declare function form.
    expect(out).not.toContain('JSX.Element');
    expect(out).not.toContain('ForwardRefExoticComponent');
  });
});

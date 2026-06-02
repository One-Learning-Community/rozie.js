/**
 * Phase 22 Plan 22-03 Task 1 — emitSolidTypes behaviour tests.
 *
 * The Solid `.d.rozie.ts` renderer consumes the core-shared
 * `renderPropsInterface` (Plan 22-02 LOCKED CONTRACT) for the props body and
 * swaps ONLY the default export to Solid's inline
 * `import('solid-js').Component<<Name>Props>` idiom (PATTERNS Pattern 2).
 *
 * Test 1: Counter (model:true) emits the shared `<Name>Props` body + the Solid
 *         default-export line.
 * Test 2: Dropdown ($expose) emits `export interface DropdownHandle { ... }`.
 * Test 3: empty ir.expose emits NO handle interface.
 * Test 4: default export is `import('solid-js').Component<CounterProps>`.
 *
 * NOTE: Solid's vitest include is `src/**` only — this test lives under
 * src/__tests__, NOT tests/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSolidTypes } from '../emit/emitTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
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

describe('emitSolidTypes — Phase 22 Plan 22-03', () => {
  it('Test 1: Counter — shared props body (model triplet) + Solid default export', () => {
    const out = emitSolidTypes(load('Counter'));
    expect(out).toContain(`export interface CounterProps {`);
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
    expect(out).toContain(`step?: number;`);
    expect(out).toContain(
      `declare const Counter: import('solid-js').Component<CounterProps>;`,
    );
    expect(out).toContain(`export default Counter;`);
  });

  it('Test 2: Dropdown ($expose) — exported handle interface + default export', () => {
    const out = emitSolidTypes(load('Dropdown'));
    expect(out).toContain(`export interface DropdownHandle {`);
    expect(out).toMatch(/\btoggle:/);
    expect(out).toMatch(/\bclose:/);
    expect(out).toContain(
      `declare const Dropdown: import('solid-js').Component<DropdownProps>;`,
    );
  });

  it('Test 3: empty ir.expose — NO handle interface', () => {
    const ir = load('Counter');
    expect((ir.expose ?? []).length).toBe(0);
    const out = emitSolidTypes(ir);
    expect(out).not.toContain('Handle {');
    expect(out).not.toContain('CounterHandle');
  });

  it('Test 4: default export idiom is import(\'solid-js\').Component<CounterProps>', () => {
    const out = emitSolidTypes(load('Counter'));
    expect(out).toContain(`import('solid-js').Component<CounterProps>`);
    expect(out).not.toContain('DefineComponent');
    expect(out).not.toContain('ForwardRefExoticComponent');
  });
});

/**
 * Phase 22 Plan 22-04 Task 2 — emitAngularTypes behaviour tests.
 *
 * The Angular `.d.rozie.ts` renderer consumes the core-shared
 * `renderPropsInterface` (Plan 22-02 LOCKED CONTRACT) for the props body and
 * swaps the default-export idiom to Angular's shape (PATTERNS Pattern 2 +
 * SPIKE-FINDINGS validated shape):
 *   - `export interface <Name>Props { … }` (shared body),
 *   - `declare class <Name> { … }` carrying the typed prop members + the PUBLIC
 *     `ir.expose` methods (Phase 21 21-06 Angular public-method guarantee),
 *     exported as the default (a TS class is both a value and a type, so it is
 *     the DI token AND the instance type — no separate `declare const … :
 *     Type<…>`, which would duplicate-identify with the class binding).
 *
 * SPIKE-FINDINGS Angular verdict (BINDING): the sidecar `<Name>.d.rozie.ts`
 * COEXISTS with the existing disk-cache `<Name>.rozie.ts` under `src/**\/*.ts`
 * with zero duplicate-identifier / ambiguity error — they are distinct modules
 * (`./Foo.rozie` vs `./Foo.rozie.ts`). The sidecar is therefore WRITTEN to disk
 * like the other targets (Plan 05 wires the write path); see 22-04-SUMMARY.
 *
 * Test 1: Counter — `declare class Counter` + non-empty typed-props string.
 * Test 2: Dropdown ($expose) — PUBLIC class methods from ir.expose declared.
 * Test 3: shared `<Name>Props` interface present.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitAngularTypes } from '../src/emit/emitTypes.js';

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

describe('emitAngularTypes — Phase 22 Plan 22-04', () => {
  it('Test 1: Counter — declare class + typed props surface (non-empty)', () => {
    const out = emitAngularTypes(load('Counter'));
    expect(out.length).toBeGreaterThan(0);
    // Phase 22: the class is a NAMED export (`export declare class`) so the
    // cross-rozie re-export shim's `export *` re-exports the named class — this
    // closes the cross-rozie-shim-vs-sidecar TS2614 shadowing (Plan-05 entry
    // condition). `declare class Counter {` is still a substring.
    expect(out).toContain(`export declare class Counter {`);
    // Default export is the component class (value + type).
    expect(out).toContain(`export default Counter;`);
  });

  it('Test 2: Dropdown ($expose) — PUBLIC class methods declared', () => {
    const out = emitAngularTypes(load('Dropdown'));
    expect(out).toMatch(/\btoggle\b/);
    expect(out).toMatch(/\bclose\b/);
    // Public — no access modifier / private-field sigil in the class body.
    expect(out).not.toContain('private ');
    expect(out).not.toContain('protected ');
    expect(out).not.toContain('#');
  });

  it('Test 3: shared <Name>Props interface present', () => {
    const out = emitAngularTypes(load('Counter'));
    expect(out).toContain(`export interface CounterProps {`);
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
    expect(out).toContain(`step?: number;`);
  });
});

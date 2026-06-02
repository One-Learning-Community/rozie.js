/**
 * Phase 22 Plan 22-04 Task 1 — emitLitTypes behaviour tests.
 *
 * The Lit `.d.rozie.ts` renderer consumes the core-shared `renderPropsInterface`
 * (Plan 22-02 LOCKED CONTRACT) for the props body, but swaps the default export
 * to Lit's NOVEL idiom (PATTERNS Pattern 2 table):
 *   - `export default class <Name> extends LitElement { … }` whose body declares
 *     the `ir.expose` methods as PUBLIC members, and
 *   - a `declare global { interface HTMLElementTagNameMap { 'rozie-<kebab>':
 *     <Name> } }` entry so `document.querySelector('rozie-foo')` is typed.
 *
 * Test 1: Counter emits `export default class Counter extends LitElement` and a
 *         `HTMLElementTagNameMap` entry keyed `'rozie-counter'` → Counter.
 * Test 2: the kebab tag in the map entry equals shell.ts's @customElement tag for
 *         the SAME IR (asserted via the shared `emitTagName` helper, NOT a
 *         hard-coded string — the tag cannot drift from the runtime registration).
 * Test 3: Dropdown ($expose({toggle, close})) declares the exposed methods as
 *         PUBLIC class members (no `private`/`protected`/`#`); Counter (no expose)
 *         adds no expose methods.
 * Test 4: the shared `<Name>Props` interface is present and exported.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitTagName } from '../src/emit/emitDecorator.js';
import { emitLitTypes } from '../src/emit/emitTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const PKG_ROOT = resolve(__dirname, '..');

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

describe('emitLitTypes — Phase 22 Plan 22-04', () => {
  it('Test 1: Counter — element class + HTMLElementTagNameMap entry', () => {
    const out = emitLitTypes(load('Counter'));
    // Header is the type-only LitElement import (NOT the React ReactNode import).
    expect(out).toContain(`import type { LitElement } from 'lit';`);
    // WR-07: the declaration-file-safe `declare` form (not a non-`declare`
    // `export default class`), plus a separate `export default`.
    expect(out).toContain(`export declare class Counter extends LitElement {`);
    expect(out).toContain(`export default Counter;`);
    expect(out).not.toContain(`export default class Counter`);
    // The novel Lit value-add: the tag-name map entry for typed querySelector.
    expect(out).toContain(`declare global {`);
    expect(out).toContain(`interface HTMLElementTagNameMap {`);
    expect(out).toContain(`'rozie-counter': Counter;`);
  });

  it('Test 2: kebab tag matches shell.ts @customElement tag (no drift)', () => {
    const ir = load('Counter');
    const out = emitLitTypes(ir);
    // Assert equality against the SAME helper the runtime decorator uses —
    // a hard-coded string would let the map entry silently drift from the
    // @customElement registration (T-22-04-01).
    const tag = emitTagName(ir.name); // → 'rozie-counter'
    expect(out).toContain(`'${tag}': ${ir.name};`);
  });

  it('Test 3: Dropdown ($expose) — exposed methods are PUBLIC members', () => {
    const out = emitLitTypes(load('Dropdown'));
    // Exposed methods declared on the element class.
    expect(out).toMatch(/\btoggle\b/);
    expect(out).toMatch(/\bclose\b/);
    // No access modifier / private-field sigil on the class body.
    expect(out).not.toContain('private ');
    expect(out).not.toContain('protected ');
    expect(out).not.toContain('#');

    // Counter has NO $expose → no expose method members added (the only class
    // members are whatever the element class needs structurally).
    const counterOut = emitLitTypes(load('Counter'));
    // Counter's class body must not invent a toggle/close.
    expect(counterOut).not.toMatch(/\btoggle\b/);
  });

  it('Test 4: shared <Name>Props interface present + exported', () => {
    const out = emitLitTypes(load('Counter'));
    expect(out).toContain(`export interface CounterProps {`);
    // Shared renderer produces the SAME model-triplet lines as the other targets.
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
    expect(out).toContain(`step?: number;`);
  });
});

// WR-07: the prior tests only assert SUBSTRINGS. This gate proves the emitted
// Lit `.d.rozie.ts` is a VALID TypeScript declaration file in isolation — it
// would have caught the declaration-context illegality (e.g. TS1183) that the
// non-`declare` `export default class … extends LitElement {}` form risked, a
// failure that previously only surfaced in the consumer demo typecheck (gated
// behind a build that can be skipped). tsc pattern mirrors
// src/__tests__/exposeProbe-typecheck.test.ts.
const SIDECAR_TSCONFIG = {
  compilerOptions: {
    noEmit: true,
    module: 'ESNext',
    target: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    // `.d.rozie.ts` is a declaration-for-arbitrary-extension; tsc only honors
    // it as a declaration file when this flag is set (the same flag consumers
    // set per docs/guide/install.md).
    allowArbitraryExtensions: true,
    skipLibCheck: true,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  },
  // Type-check the emitted sidecar directly as a declaration file.
  include: ['Counter.d.rozie.ts'],
};

describe('emitLitTypes — WR-07 emitted sidecar is a valid .d.ts (tsc --noEmit)', () => {
  it('Counter.d.rozie.ts type-checks clean in isolation', () => {
    const sidecar = emitLitTypes(load('Counter'));
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-lit-sidecar-tsc-'));
    try {
      writeFileSync(join(tmpDir, 'Counter.d.rozie.ts'), sidecar, 'utf8');
      writeFileSync(
        join(tmpDir, 'tsconfig.json'),
        JSON.stringify(SIDECAR_TSCONFIG, null, 2),
        'utf8',
      );
      // Symlink the package's node_modules so tsc resolves `lit` (the
      // `import type { LitElement } from 'lit'` header).
      symlinkSync(join(PKG_ROOT, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(PKG_ROOT, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

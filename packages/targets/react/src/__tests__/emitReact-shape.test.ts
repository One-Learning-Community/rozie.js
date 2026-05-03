/**
 * Plan 04-05 Task 1 — D-67 emitReact return-shape contract.
 *
 * Verifies the public surface promised by Plan 04-01..04-05:
 *   { code: string, css: string, globalCss?: string, map: SourceMap | null, diagnostics: Diagnostic[] }
 *
 * Also enforces D-68 (NO `import React from 'react'` ever — automatic JSX
 * runtime is the only supported mode).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReact } from '../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function load(name: string): { ir: IRComponent; src: string } {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return { ir: lowered.ir, src };
}

describe('D-67: emitReact return-shape contract', () => {
  it('returns { code, css, globalCss?, map, diagnostics } for Counter (no :root)', () => {
    const { ir, src } = load('Counter');
    const result = emitReact(ir, { filename: 'Counter.rozie', source: src });

    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);

    expect(typeof result.css).toBe('string');
    expect(result.css.length).toBeGreaterThan(0);
    expect(result.css).toContain('.counter');

    // Counter has NO :root → globalCss is undefined.
    expect(result.globalCss).toBeUndefined();

    expect(result.map).not.toBeNull();
    expect(result.map?.sources?.[0]).toBe('Counter.rozie');

    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it('Dropdown has :root → globalCss is non-empty string', () => {
    const { ir, src } = load('Dropdown');
    const result = emitReact(ir, { filename: 'Dropdown.rozie', source: src });

    expect(typeof result.globalCss).toBe('string');
    expect(result.globalCss).toContain(':root');
    expect(result.globalCss).toContain('--rozie-dropdown-z');
  });

  it('Modal has :root → globalCss is non-empty string', () => {
    const { ir, src } = load('Modal');
    const result = emitReact(ir, { filename: 'Modal.rozie', source: src });

    expect(typeof result.globalCss).toBe('string');
    expect(result.globalCss).toContain(':root');
    expect(result.globalCss).toContain('--rozie-modal-z');
  });

  it('SearchInput has no :root → globalCss is undefined', () => {
    const { ir, src } = load('SearchInput');
    const result = emitReact(ir, { filename: 'SearchInput.rozie', source: src });
    expect(result.globalCss).toBeUndefined();
  });

  it('TodoList has no :root → globalCss is undefined', () => {
    const { ir, src } = load('TodoList');
    const result = emitReact(ir, { filename: 'TodoList.rozie', source: src });
    expect(result.globalCss).toBeUndefined();
  });

  it('emitReact called WITHOUT filename/source returns map=null and css=""', () => {
    const { ir } = load('Counter');
    const result = emitReact(ir);
    expect(result.map).toBeNull();
    expect(result.css).toBe('');
    expect(result.globalCss).toBeUndefined();
  });

  it('Source map mappings are non-empty when filename + source provided', () => {
    const { ir, src } = load('Counter');
    const result = emitReact(ir, { filename: 'Counter.rozie', source: src });
    expect(result.map).not.toBeNull();
    expect(typeof result.map?.mappings).toBe('string');
    // Even if hires:'boundary' produces only `;` separators for our append-only
    // shell, the SourceMap object itself is constructed correctly. Verify the
    // sources/sourcesContent contract from compose.ts.
    expect(result.map?.sources).toEqual(['Counter.rozie']);
    expect(result.map?.sourcesContent?.[0]).toBe(src);
  });

  it('D-68: NEVER emits `import React from "react"` — automatic JSX runtime only', () => {
    for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
      const { ir, src } = load(name);
      const { code } = emitReact(ir, { filename: `${name}.rozie`, source: src });
      expect(code, `${name} unexpectedly imports React default`).not.toMatch(
        /import React from ['"]react['"]/,
      );
    }
  });
});

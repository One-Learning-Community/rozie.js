/**
 * Phase 22 Plan 22-03 Task 1 — emitSvelteTypes behaviour tests.
 *
 * The Svelte `.d.rozie.ts` renderer consumes the core-shared
 * `renderPropsInterface` (Plan 22-02 LOCKED CONTRACT) for the props body and
 * swaps ONLY the default export to Svelte's inline
 * `import('svelte').Component<<Name>Props>` idiom (PATTERNS Pattern 2; the shape
 * SPIKE-FINDINGS validated for the Svelte arm).
 *
 * Test 1: Counter (model:true) emits the shared `<Name>Props` body + the Svelte
 *         default-export line.
 * Test 2: Dropdown ($expose) emits `export interface DropdownHandle { ... }`.
 * Test 3: empty ir.expose emits NO handle interface.
 * Test 4: default export is `import('svelte').Component<CounterProps>`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../core/src/ir/types.js';
import { emitSvelteTypes } from '../src/emit/emitTypes.js';

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

describe('emitSvelteTypes — Phase 22 Plan 22-03', () => {
  it('Test 1: Counter — shared props body (model triplet) + Svelte default export', () => {
    const out = emitSvelteTypes(load('Counter'));
    // Typed public surface phase 3 — Counter is a single-<div>-root,
    // attr-inheriting component, so its interface extends the div's attrs.
    expect(out).toContain(
      `export interface CounterProps extends Omit<import('svelte/elements').SvelteHTMLElements['div'], `,
    );
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
    expect(out).toContain(`step?: number;`);
    // Svelte default export idiom (inline import form).
    expect(out).toContain(
      `declare const Counter: import('svelte').Component<CounterProps>;`,
    );
    expect(out).toContain(`export default Counter;`);
    // Counter has NO slots → NO Snippet import (mirrors compiled .svelte).
    expect(out).not.toContain('Snippet');
  });

  it('Test 2: Dropdown ($expose) — exported handle interface + default export', () => {
    const out = emitSvelteTypes(load('Dropdown'));
    expect(out).toContain(`export interface DropdownHandle {`);
    expect(out).toMatch(/\btoggle:/);
    expect(out).toMatch(/\bclose:/);
    expect(out).toContain(
      `declare const Dropdown: import('svelte').Component<DropdownProps>;`,
    );
  });

  it('Test 3: empty ir.expose — NO handle interface', () => {
    const ir = load('Counter');
    expect((ir.expose ?? []).length).toBe(0);
    const out = emitSvelteTypes(ir);
    expect(out).not.toContain('Handle {');
    expect(out).not.toContain('CounterHandle');
  });

  it('Test 4: default export idiom is import(\'svelte\').Component<CounterProps>', () => {
    const out = emitSvelteTypes(load('Counter'));
    expect(out).toContain(`import('svelte').Component<CounterProps>`);
    expect(out).not.toContain('DefineComponent');
    expect(out).not.toContain('JSX.Element');
  });

  it('Test 5: a slotted component imports Snippet and uses it as the slot token', () => {
    // TodoList declares slots → the sidecar adds the Snippet import and uses
    // `Snippet` as the slot-children token (mirrors compiled .svelte).
    const out = emitSvelteTypes(load('TodoList'));
    expect(out.startsWith(`import type { Snippet } from 'svelte';`)).toBe(true);
    expect(out).toContain('Snippet');
  });
});

describe('Svelte — typed public surface phase 3 (pass-through HTML attrs)', () => {
  const fixtureSrc = (): string =>
    readFileSync(resolve(REPO_ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'), 'utf8');

  it('sidecar: a single-<button>-root attr-inheriting component extends SvelteHTMLElements[button]', () => {
    const parsed = parse(fixtureSrc(), { filename: 'AttrsButton.rozie' });
    if (!parsed.ast) throw new Error('parse failed for AttrsButton');
    const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lower failed for AttrsButton');
    // The shared sidecar renderer names emits `on<Pascal>` on every target.
    expect(emitSvelteTypes(lowered.ir)).toContain(
      "export interface AttrsButtonProps extends Omit<import('svelte/elements').SvelteHTMLElements['button'], 'label' | 'title' | 'onPress' | 'children'> {",
    );
  });

  it('inline: Props extends the root attrs and drops the [key: string]: unknown index signature', async () => {
    const { compile } = await import('../../../core/src/compile.js');
    const { code } = compile(fixtureSrc(), { target: 'svelte', filename: 'AttrsButton.rozie', sourceMap: false });
    // The inline Svelte callback prop is all-lowercase `onpress`.
    expect(code).toContain(
      "interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['button'], 'label' | 'title' | 'onpress' | 'children'> {",
    );
    expect(code).not.toContain('[key: string]: unknown');
  });

  it('inherit-attrs="false" + manual r-bind (ThemedButtonManual) keeps the index signature and plain header', async () => {
    const { compile } = await import('../../../core/src/compile.js');
    const src = readFileSync(resolve(EXAMPLES, 'ThemedButtonManual.rozie'), 'utf8');
    const { code } = compile(src, { target: 'svelte', filename: 'ThemedButtonManual.rozie', sourceMap: false });
    expect(code).toContain('interface Props {');
    expect(code).toContain('  [key: string]: unknown;');
    expect(emitSvelteTypes(load('ThemedButtonManual'))).toContain('export interface ThemedButtonManualProps {');
  });
});

describe('Svelte — typed public surface phase 3 — fields-less Props', () => {
  it('a zero-prop attr-inheriting component renders `interface Props extends Omit<…> {}` (no empty body line)', async () => {
    const { compile } = await import('../../../core/src/compile.js');
    const src = '<rozie name="Bare">\n<template>\n<button>x</button>\n</template>\n</rozie>\n';
    const { code } = compile(src, { target: 'svelte', filename: 'Bare.rozie', sourceMap: false });
    expect(code).toContain(
      "interface Props extends Omit<import('svelte/elements').SvelteHTMLElements['button'], 'children'> {}",
    );
  });

  it('untyped emit handler on the inline props type is (...args: any[]) => void', async () => {
    const { compile } = await import('../../../core/src/compile.js');
    const src = `<rozie name="E">\n<script>\nfunction f(){ $emit('ping', 1) }\n</script>\n<template><div></div></template>\n</rozie>\n`;
    const { code } = compile(src, { target: 'svelte', filename: 'E.rozie', sourceMap: false });
    expect(code).toContain('(...args: any[]) => void');
    expect(code).not.toContain('(...args: unknown[]) => void');
  });
});

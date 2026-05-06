// Phase 5 Plan 02a Task 3 — 5 whole-SFC fixture snapshots locked.
//
// Each example .rozie compiles to a .svelte.snap fixture; per-example
// substring invariants follow:
//   - Counter — basic shell + $bindable + console.log("hello from rozie") (DX-03)
//   - SearchInput — debounce inline IIFE (no @rozie/runtime-svelte)
//   - Dropdown — three $effect blocks (outside-click, escape, throttle resize)
//                + :global(:root) for CSS-variable escape hatch
//   - TodoList — Snippet<[any]>, {#each items as item (item.id)}, {@render header?.(...)}
//   - Modal — :global(:root), paired-cleanup $effect, multiple slot fallbacks
//
// All 5 emitted SFCs must compile cleanly via Svelte 5's compile() — Pitfall 6
// mitigation. Smoke test asserts compileSvelte does NOT throw / log warnings
// for parse errors.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile as compileSvelte } from 'svelte/compiler';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitSvelte } from '../emitSvelte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): { ir: IRComponent; src: string; filename: string } {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src, filename };
}

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('emitSvelte — 5 whole-SFC fixture snapshots locked', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name}.svelte.snap`, async () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitSvelte(ir, { filename, source: src });
      await expect(code).toMatchFileSnapshot(resolve(FIXTURES, `${name}.svelte.snap`));
    });
  }
});

describe('emitSvelte — Plan 02a smoke tests (svelte/compiler parses emitted output)', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name} compiles cleanly via svelte/compiler`, () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitSvelte(ir, { filename, source: src });
      // Pitfall 6 mitigation: ensure the emitted .svelte parses + compiles
      // via Svelte 5's compiler. compileSvelte returns a result with
      // warnings[]; throws on hard parse errors.
      const result = compileSvelte(code, {
        filename: `${name}.svelte`,
        generate: 'client',
      });
      // Hard parse errors throw; if we got a result, the parse succeeded.
      expect(result).toBeDefined();
      expect(result.js).toBeDefined();
      // Filter out non-error warnings — focus on anything signalling a parse
      // problem. Svelte 5 emits various non-fatal warnings we don't care about
      // (e.g., 'a11y-no-onclick'); only filter for things that would prevent
      // shipment in v1.
      const fatalWarnings = (result.warnings ?? []).filter((w: { code: string }) =>
        /parse|invalid|error/i.test(w.code),
      );
      expect(fatalWarnings).toEqual([]);
    });
  }
});

describe('emitSvelte — substring invariants (Plan 02a Task 3 acceptance criteria)', () => {
  it('Counter.svelte.snap contains literal `value = $bindable(0)` AND `console.log("hello from rozie")`', () => {
    const { ir, src, filename } = loadExample('Counter');
    const { code } = emitSvelte(ir, { filename, source: src });
    expect(code).toContain('value = $bindable(0)');
    expect(code).toContain('console.log("hello from rozie")');
  });

  it('Dropdown.svelte.snap contains three $effect blocks (outside-click + escape + throttle resize)', () => {
    const { ir, src, filename } = loadExample('Dropdown');
    const { code } = emitSvelte(ir, { filename, source: src });
    const effectMatches = code.match(/\$effect\(/g) ?? [];
    expect(effectMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('Dropdown.svelte.snap contains `:global(:root)` (Pattern 5 escape hatch)', () => {
    const { ir, src, filename } = loadExample('Dropdown');
    const { code } = emitSvelte(ir, { filename, source: src });
    expect(code).toContain(':global(:root)');
  });

  it('TodoList.svelte.snap contains Snippet<[any]>, {#each items as item (item.id)}, {@render header?.(...)}', () => {
    const { ir, src, filename } = loadExample('TodoList');
    const { code } = emitSvelte(ir, { filename, source: src });
    expect(code).toContain('Snippet<[');
    expect(code).toContain('{#each items as item (item.id)}');
    expect(code).toMatch(/\{@render header\?\.\([^)]*\)\}|\{#if header\}\{@render header\(/);
  });

  it('Modal.svelte.snap contains :global(:root) AND paired-cleanup $effect', () => {
    const { ir, src, filename } = loadExample('Modal');
    const { code } = emitSvelte(ir, { filename, source: src });
    expect(code).toContain(':global(:root)');
    // D-19: ONE $effect with both lockScroll() and unlockScroll() (paired pattern).
    expect(code).toMatch(
      /\$effect\(\(\) => \{[\s\S]*lockScroll\(\)[\s\S]*return \(\) => unlockScroll\(\)[\s\S]*\}\);/,
    );
  });

  it('SearchInput.svelte.snap contains inline debounce IIFE (no @rozie/runtime-svelte import)', () => {
    const { ir, src, filename } = loadExample('SearchInput');
    const { code } = emitSvelte(ir, { filename, source: src });
    expect(code).toMatch(/const debounced[A-Za-z_]* = \(\(\) => \{/);
    expect(code).toContain('setTimeout');
    expect(code).not.toContain("from '@rozie/runtime-svelte'");
  });

  it('NO `on:event` Svelte-4 syntax in any of the 5 emitted SFCs (Pitfall 4 mitigation)', () => {
    for (const name of EXAMPLE_NAMES) {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitSvelte(ir, { filename, source: src });
      expect(code, `${name} contains forbidden Svelte 4 on: syntax`).not.toMatch(/\son:[a-z]/);
    }
  });
});

describe('emitSvelte — DX-01 source map composes against original .rozie source', () => {
  it('SearchInput.svelte source map references the .rozie filename', () => {
    const { ir, src, filename } = loadExample('SearchInput');
    const { map } = emitSvelte(ir, { filename, source: src });
    expect(map).not.toBeNull();
    expect(map!.sources).toEqual([filename]);
    expect(map!.sourcesContent).toEqual([src]);
  });
});

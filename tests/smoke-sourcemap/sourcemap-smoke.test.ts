/**
 * sourcemap-smoke.test.ts — Phase 06.1 P3 5-example × 4-target Source Map v3 smoke harness.
 *
 * For every (example × target) pair (5 × 4 = 20 cases):
 *   1. Compile the example via the public emit pipeline (parse → lowerToIR → emit{Target}).
 *   2. Assert result.map is not null, mappings is non-empty, and sources[0] ends in .rozie.
 *   3. Assert SourceMapConsumer accepts the map.
 *
 * Stronger per-line assertions are in the per-target unit tests (sourcemap.test.ts) using
 * Counter.rozie's `hovering` identifier; this harness covers the broader "no composition errors"
 * surface across all 5 reference examples.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import {
  parse,
  lowerToIR,
  createDefaultRegistry,
  type IRComponent,
  type BlockMap,
} from '@rozie/core';
import { emitVue } from '@rozie/target-vue';
import { emitReact } from '@rozie/target-react';
import { emitSvelte } from '@rozie/target-svelte';
import { emitAngular } from '@rozie/target-angular';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../examples');
const EXAMPLES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

interface EmitOpts {
  filename: string;
  source: string;
  blockOffsets: BlockMap;
}

interface EmitResult {
  code: string;
  map: {
    version?: number;
    sources: string[];
    sourcesContent?: (string | null)[] | null;
    names?: string[];
    mappings: string;
  } | null;
}

type EmitFn = (ir: IRComponent, opts: EmitOpts) => EmitResult;

const TARGETS: Array<{ name: string; emit: EmitFn; ext: string }> = [
  { name: 'vue', emit: emitVue as unknown as EmitFn, ext: '.vue' },
  { name: 'react', emit: emitReact as unknown as EmitFn, ext: '.tsx' },
  { name: 'svelte', emit: emitSvelte as unknown as EmitFn, ext: '.svelte' },
  { name: 'angular', emit: emitAngular as unknown as EmitFn, ext: '.ts' },
];

describe.each(EXAMPLES)('sourcemap smoke — %s.rozie', (exampleName) => {
  const filename = `${exampleName}.rozie`;
  const src = readFileSync(resolve(EXAMPLES_DIR, filename), 'utf8');
  const parseRes = parse(src, { filename });
  if (!parseRes.ast) throw new Error(`parse() returned null AST for ${exampleName}`);
  const ast = parseRes.ast;
  const lowered = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${exampleName}`);
  const ir = lowered.ir;

  describe.each(TARGETS)('target = $name', ({ emit, ext }) => {
    const result = emit(ir, { filename, source: src, blockOffsets: ast.blocks });

    it('emits a non-null Source Map v3', () => {
      expect(result.map).not.toBeNull();
      expect(result.map!.version).toBe(3);
    });

    it('mappings field is non-empty (DX-04 regression guard — pre-Phase-06.1 produced empty/degenerate mappings)', () => {
      expect(result.map!.mappings.length).toBeGreaterThan(0);
      // Reject the degenerate "all semicolons/commas" pattern that the
      // single-segment hack produced.
      expect(/^[;,]*$/.test(result.map!.mappings)).toBe(false);
    });

    it('sources[0] ends in .rozie', () => {
      expect(result.map!.sources).toHaveLength(1);
      expect(result.map!.sources[0]?.endsWith('.rozie')).toBe(true);
    });

    it('SourceMapConsumer accepts the map without throwing', () => {
      const consumer = new SourceMapConsumer({
        version: 3,
        sources: result.map!.sources,
        sourcesContent: result.map!.sourcesContent ?? null,
        names: result.map!.names ?? [],
        mappings: result.map!.mappings,
        file: `${filename}${ext}`,
      } as unknown as Parameters<typeof SourceMapConsumer>[0]);
      expect(consumer).toBeDefined();
    });
  });
});

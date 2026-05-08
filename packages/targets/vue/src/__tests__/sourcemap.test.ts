// Phase 3 Plan 05 Task 2 — sourcemap.test.ts
//
// composeSourceMap wraps magic-string.generateMap to thread .rozie byte
// offsets through to emitted .vue offsets per Pitfall 2 (line 705):
//   - sources[0] is the .rozie file path
//   - sourcesContent[0] is the original .rozie source text
//   - mappings is non-empty (magic-string emits per-segment mappings)
//
// The full DX-01 round-trip ('breakpoint in .rozie lands on the right line')
// is verified by Plan 06's Playwright e2e — Plan 05 verifies the in-memory
// SourceMapConsumer can read the map and resolve at least one position back
// to the .rozie source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import MagicString from 'magic-string';
import { SourceMapConsumer } from 'source-map-js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitVue } from '../emitVue.js';
import { composeSourceMap } from '../sourcemap/compose.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): { ir: IRComponent; src: string } {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src };
}

describe('composeSourceMap — magic-string wrapper', () => {
  it('Test 1: produces map with sources=[filename], sourcesContent=[source], non-empty mappings', () => {
    const ms = new MagicString('');
    ms.append('hello world\n');
    ms.append('second line\n');
    const map = composeSourceMap(ms, {
      filename: '/abs/Counter.rozie',
      source: '<rozie>...</rozie>',
      scriptMap: null,
      scriptOutputOffset: 0,
    });
    expect(map.sources).toEqual(['/abs/Counter.rozie']);
    expect(map.sourcesContent).toEqual(['<rozie>...</rozie>']);
    expect(typeof map.mappings).toBe('string');
    // mappings is non-empty when magic-string was given content via append.
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it('Test 2: defensive override re-asserts sources + sourcesContent (Pitfall 2 mitigation)', () => {
    const ms = new MagicString('');
    ms.append('content\n');
    const map = composeSourceMap(ms, {
      filename: 'Counter.rozie',
      source: 'original-source-text',
      scriptMap: null,
      scriptOutputOffset: 0,
    });
    expect(map.sources[0]).toBe('Counter.rozie');
    expect(map.sourcesContent![0]).toBe('original-source-text');
  });
});

describe('emitVue source map integration (Pitfall 2)', () => {
  it('Test 3: emitVue(ir, { filename, source }) returns map with sources[0] ending in .rozie', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitVue(ir, {
      filename: '/abs/Counter.rozie',
      source: src,
    });
    expect(result.map).not.toBeNull();
    expect(result.map!.sources[0]).toMatch(/\.rozie$/);
    expect(result.map!.sources[0]).toBe('/abs/Counter.rozie');
  });

  it('Test 4: emitVue map sourcesContent equals original .rozie source', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitVue(ir, {
      filename: '/abs/Counter.rozie',
      source: src,
    });
    expect(result.map).not.toBeNull();
    expect(result.map!.sourcesContent).toBeDefined();
    expect(result.map!.sourcesContent![0]).toBe(src);
  });

  it('Test 5: emitVue map mappings is non-empty', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitVue(ir, {
      filename: 'Counter.rozie',
      source: src,
    });
    expect(result.map).not.toBeNull();
    expect(typeof result.map!.mappings).toBe('string');
    expect(result.map!.mappings.length).toBeGreaterThan(0);
  });

  it('Test 6: emitVue without filename+source returns map=null (back-compat with Plan 02 callers)', () => {
    const { ir } = loadExample('Counter');
    const result = emitVue(ir);
    expect(result.map).toBeNull();
  });

  it('Test 7 (Phase 06.1 D-110 / sourcemap-fix): console.log in <script> resolves to its exact .rozie source line', () => {
    // Phase 06.1 + sourcemap-fix — proves the buildShell rearchitecture (P1) +
    // emitScript single-program scriptMap (sourcemap-fix) produce a composed map
    // that resolves user-authored residual statements back to their exact .rozie
    // source line, NOT line 1 col 0 (the pre-Phase-06.1 degenerate behavior).
    //
    // We query `console.log("hello from rozie")` — a residual statement (not a
    // preamble/generated line like `const hovering = ref(false)`). The userCodeLineOffset
    // fix targets residual statements; generated preamble lines (defineProps, refs,
    // computed) are mapped via the shell map fallback (per-block accuracy).
    //
    // The fix: emitScript now produces a real scriptMap from residual statements via
    // a single-program @babel/generator call. buildShell computes userCodeLineOffset
    // (total .vue lines before user code begins). composeMaps shifts the scriptMap's
    // VLQ mappings by userCodeLineOffset semicolons so the final map resolves
    // `console.log` in the .vue output directly to its .rozie source line.
    const filename = 'Counter.rozie';
    const { ir, src } = loadExample('Counter');
    const result = emitVue(ir, {
      filename,
      source: src,
    });

    expect(result.map).not.toBeNull();
    const map = result.map!;

    // Locate `console.log("hello from rozie")` in the emitted .vue output.
    // This is a residual statement — present verbatim in the emitted <script setup>.
    const declMatch = 'console.log("hello from rozie")';
    const declIdx = result.code.indexOf(declMatch);
    expect(declIdx).toBeGreaterThan(-1);

    // Convert byte offset → (line, col) — 1-based line, 0-based column per Source Map v3.
    const before = result.code.slice(0, declIdx);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    const column = lastNewline === -1 ? declIdx : declIdx - (lastNewline + 1);

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: map.sources,
      sourcesContent: map.sourcesContent ?? null,
      names: map.names ?? [],
      mappings: map.mappings,
      file: 'Counter.rozie.vue',
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    const pos = consumer.originalPositionFor({ line, column });

    // Derive the expected source line at runtime so the test survives edits.
    // `console.log("hello from rozie")` appears on the first line of <script>.
    const consoleLine = src.split('\n').findIndex((l) => /console\.log\("hello from rozie"\)/.test(l)) + 1;
    const scriptEndLine = src.split('\n').findIndex((l) => /<\/script>/.test(l)) + 1;
    expect(consoleLine).toBeGreaterThan(0);
    expect(scriptEndLine).toBeGreaterThan(0);

    expect(pos.source).toBe(filename);
    expect(pos.line).not.toBe(1); // explicit regression guard (D-110 wording)
    expect(pos.line).not.toBeNull();
    // Per-statement accuracy: pos.line resolves to exactly the console.log line.
    expect(pos.line!).toBe(consoleLine);
  });
});

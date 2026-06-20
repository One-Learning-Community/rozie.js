/**
 * composeMaps.test.ts — Phase 06.1 P2 Task 1.
 *
 * Unit tests for the shared composeMaps helper:
 *   1. Zero-children fallback — returns shell map verbatim with sources
 *      and sourcesContent re-asserted to opts.filename / opts.source.
 *   2. Single-child merge — invokes @ampproject/remapping; result has
 *      sources=[opts.filename], sourcesContent=[opts.source], non-empty
 *      mappings.
 *   3. Defensive sources/sourcesContent re-assertion — when remapping
 *      returns a map whose sources differ from opts.filename (e.g. after
 *      path normalization), the helper post-mutates the result.
 */
import { describe, it, expect } from 'vitest';
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { composeMaps, buildPartialLineOffsets } from '../composeMaps.js';
import type { File as BabelFile } from '@babel/types';

describe('composeMaps — D-100 shared helper', () => {
  it('Test 1: zero-children fallback returns shell map with sources/sourcesContent re-asserted', () => {
    const ms = new MagicString('source code here');
    ms.overwrite(0, 6, 'OUTPUT');
    const map = composeMaps({
      filename: 'Counter.rozie',
      source: 'source code here',
      shellMs: ms,
      children: [],
      fileExt: '.vue',
    });
    expect(map.sources).toEqual(['Counter.rozie']);
    expect(map.sourcesContent).toEqual(['source code here']);
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it('Test 2: single-child merge invokes remapping and produces non-empty mappings', () => {
    const ms = new MagicString('foo bar baz');
    ms.overwrite(0, 3, 'XXX');
    const childMap: EncodedSourceMap = {
      version: 3,
      file: 'child.js',
      sources: ['Counter.rozie'],
      sourcesContent: ['Counter.rozie source'],
      names: [],
      mappings: 'AAAA',
    };
    const map = composeMaps({
      filename: 'Counter.rozie',
      source: 'Counter.rozie source',
      shellMs: ms,
      children: [{ map: childMap, outputOffset: 0 }],
      fileExt: '.tsx',
    });
    expect(map.sources).toEqual(['Counter.rozie']);
    expect(map.sourcesContent).toEqual(['Counter.rozie source']);
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it('Test 3: defensive override re-asserts sources/sourcesContent when remapping returns a different source', () => {
    // Use a child map that references a path-normalized source; verify our override re-asserts opts.filename.
    const ms = new MagicString('abc');
    ms.overwrite(0, 1, 'A');
    const childMap: EncodedSourceMap = {
      version: 3,
      sources: ['./Counter.rozie'], // different shape from opts.filename
      sourcesContent: ['different source content'],
      names: [],
      mappings: 'AAAA',
    };
    const map = composeMaps({
      filename: 'Counter.rozie',
      source: 'expected source content',
      shellMs: ms,
      children: [{ map: childMap, outputOffset: 0 }],
      fileExt: '.svelte',
    });
    expect(map.sources).toEqual(['Counter.rozie']);
    expect(map.sourcesContent).toEqual(['expected source content']);
  });

  it('Test 4 (Phase 55 SC-2): buildPartialLineOffsets derives the constant per-partial offset from stashed origins', () => {
    // Synthetic lowered script AST: two spliced statements from the SAME partial,
    // each shifted to a host-contiguous emit line with the true `.rzts` origin
    // stashed on `extra.__roziePartialOrigin`. The constant offset is 16.
    const RZTS = '/abs/partialLogicC.rzts';
    const mk = (emitLine: number, originLine: number) => ({
      type: 'VariableDeclaration',
      loc: { start: { line: emitLine, column: 0 }, end: { line: emitLine, column: 1 } },
      extra: { __roziePartialOrigin: { line: originLine, column: 0, filename: RZTS } },
    });
    const fakeAst = {
      program: { body: [mk(37, 21), mk(40, 24)] },
    } as unknown as BabelFile;

    const offsets = buildPartialLineOffsets(fakeAst);
    expect(offsets.get(RZTS)).toBe(16); // 37 - 21 === 40 - 24 === 16 (constant per block)
    expect(offsets.size).toBe(1); // one entry per partial file

    // A null/empty AST never throws and yields an empty table (D-04).
    expect(buildPartialLineOffsets(null).size).toBe(0);
    expect(buildPartialLineOffsets(undefined).size).toBe(0);
  });

  it('Test 5 (Phase 55 SC-2): the line-restore subtracts the partial offset for a .rzts-sourced mapping', () => {
    const ms = new MagicString('shell');
    ms.overwrite(0, 1, 'S');
    const RZTS = '/abs/partialLogicC.rzts';
    // Child map: one mapping at generated (0,0) → original line index 39 (0-based,
    // i.e. the host-contiguous emit line 40) in the `.rzts` source.
    // Segment = [genCol 0, srcIdx 0, origLine 39, origCol 0].
    const childMap: EncodedSourceMap = {
      version: 3,
      sources: [RZTS],
      sourcesContent: ['partial source content'],
      names: [],
      mappings: encode([[[0, 0, 39, 0]]]),
    };
    // Sanity: the encoded original line is 39 before restore.
    expect(decode(childMap.mappings)[0]![0]![2]).toBe(39);

    const map = composeMaps({
      filename: 'Host.rozie',
      source: 'host source',
      shellMs: ms,
      children: [{ map: childMap, outputOffset: 0 }],
      fileExt: '.tsx',
      userCodeLineOffset: 0,
      partialLineOffsets: new Map([[RZTS, 16]]),
    });

    // .rzts source PRESERVED (D-01 file origin), not collapsed to Host.rozie.
    expect(map.sources).toEqual([RZTS]);
    // Original line restored: 39 - 16 === 23 (0-based) ⇒ partial-local line 24.
    expect(decode(map.mappings)[0]![0]![2]).toBe(23);

    // Control: WITHOUT an offset table, the legacy path collapses to the host
    // source and leaves the (now-wrong) host-contiguous line untouched.
    const legacy = composeMaps({
      filename: 'Host.rozie',
      source: 'host source',
      shellMs: new MagicString('shell'),
      children: [{ map: childMap, outputOffset: 0 }],
      fileExt: '.tsx',
      userCodeLineOffset: 0,
    });
    expect(legacy.sources).toEqual(['Host.rozie']);
    expect(decode(legacy.mappings)[0]![0]![2]).toBe(39);
  });
});

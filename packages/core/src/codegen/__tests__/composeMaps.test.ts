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
import { composeMaps } from '../composeMaps.js';

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
});

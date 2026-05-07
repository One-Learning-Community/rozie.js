// compile() — Phase 6 Plan 06-01 Task 2 acceptance tests (DIST-01 / D-80..D-83 / D-96).
//
// 10 behaviors per plan:
//   1-4. Per-target happy path (vue, react, svelte, angular)
//   5.   D-81 collected-not-thrown contract on bad source
//   6.   D-83 sourceMap: false → result.map === null
//   7.   D-83 types: false → result.types === ''
//   8.   D-82 modifierRegistry default → createDefaultRegistry()
//   9.   D-82 explicit registry → byte-identical to default
//   10.  ROZ800 codes registry — RozieErrorCode.COMPILE_INVALID_TARGET === 'ROZ800'
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compile, type CompileTarget } from '../src/compile.js';
import { RozieErrorCode } from '../src/diagnostics/codes.js';
import { createDefaultRegistry } from '../src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(__dirname, '../../../examples/Counter.rozie');
const counterSource = readFileSync(COUNTER_PATH, 'utf8');

describe('compile() — Phase 6 public API', () => {
  describe('happy path — per-target dispatch (D-80)', () => {
    it.each<[CompileTarget]>([['vue'], ['react'], ['svelte'], ['angular']])(
      'compiles Counter.rozie to %s with no error diagnostics',
      (target) => {
        let result!: ReturnType<typeof compile>;
        expect(() => {
          result = compile(counterSource, { target, filename: 'Counter.rozie' });
        }).not.toThrow();

        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(typeof result.code).toBe('string');
        expect(result.code.length).toBeGreaterThan(0);
        expect(typeof result.types).toBe('string');
      },
    );

    it('Vue path returns inline-typed code (types === \'\') per D-84', () => {
      const result = compile(counterSource, { target: 'vue', filename: 'Counter.rozie' });
      expect(result.types).toBe('');
    });

    it('React path returns a non-empty .d.ts containing CounterProps interface (Plan 06-02 D-84)', () => {
      const result = compile(counterSource, { target: 'react', filename: 'Counter.rozie' });
      expect(result.types).toContain('export interface CounterProps');
      expect(result.types).toContain(`import type { ReactNode } from 'react';`);
    });
  });

  describe('D-81 collected-not-thrown contract', () => {
    it('returns error diagnostics — never throws — on invalid source', () => {
      // No <rozie> envelope → parse() returns ast=null + ROZ001 fatal.
      const badSource = '<not a rozie file>';
      let result!: ReturnType<typeof compile>;
      expect(() => {
        result = compile(badSource, { target: 'vue' });
      }).not.toThrow();

      expect(result.code).toBe('');
      expect(result.map).toBeNull();
      expect(result.types).toBe('');
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });

    it('returns ROZ800 on unknown target', () => {
      // Cast through unknown to exercise the runtime exhaustiveness branch.
      const result = compile(counterSource, {
        target: 'preact' as unknown as CompileTarget,
      });
      expect(result.code).toBe('');
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'ROZ800', severity: 'error' }),
      ]);
    });
  });

  describe('D-83 opts.sourceMap default behavior', () => {
    it('sourceMap defaults true — Vue produces a SourceMap', () => {
      const result = compile(counterSource, { target: 'vue', filename: 'Counter.rozie' });
      expect(result.map).not.toBeNull();
    });

    it('sourceMap: false short-circuits map to null (Pitfall 6)', () => {
      const result = compile(counterSource, {
        target: 'vue',
        filename: 'Counter.rozie',
        sourceMap: false,
      });
      expect(result.map).toBeNull();
    });
  });

  describe('D-83 opts.types default behavior', () => {
    it('types defaults true — React types is non-empty .d.ts (Plan 06-02 D-84)', () => {
      const result = compile(counterSource, { target: 'react', filename: 'Counter.rozie' });
      expect(result.types.length).toBeGreaterThan(0);
      expect(result.types).toContain('CounterProps');
    });

    it('types: false short-circuits React types to empty string', () => {
      const result = compile(counterSource, {
        target: 'react',
        filename: 'Counter.rozie',
        types: false,
      });
      expect(result.types).toBe('');
    });
  });

  describe('D-82 modifierRegistry default behavior', () => {
    it('omitted modifierRegistry succeeds (defaults to createDefaultRegistry)', () => {
      let result!: ReturnType<typeof compile>;
      expect(() => {
        result = compile(counterSource, { target: 'vue', filename: 'Counter.rozie' });
      }).not.toThrow();
      expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    });

    it('explicit createDefaultRegistry produces byte-identical code to default', () => {
      const defaulted = compile(counterSource, { target: 'vue', filename: 'Counter.rozie' });
      const explicit = compile(counterSource, {
        target: 'vue',
        filename: 'Counter.rozie',
        modifierRegistry: createDefaultRegistry(),
      });
      expect(explicit.code).toBe(defaulted.code);
    });
  });

  describe('ROZ800..ROZ899 codes registry (D-96)', () => {
    it('RozieErrorCode.COMPILE_INVALID_TARGET === \'ROZ800\'', () => {
      expect(RozieErrorCode.COMPILE_INVALID_TARGET).toBe('ROZ800');
    });

    it('RozieErrorCode.COMPILE_INVALID_OPT_COMBO === \'ROZ801\'', () => {
      expect(RozieErrorCode.COMPILE_INVALID_OPT_COMBO).toBe('ROZ801');
    });
  });
});

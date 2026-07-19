/**
 * surface.test.ts — the @rozie-ui/lexical surface gate as a vitest test (so it
 * runs under `turbo run test`, not just the standalone
 * scripts/compile-lexical-check.mjs).
 *
 * GENERIC per-source: it globs every src/*.rozie (later waves add sources without
 * editing this file) and re-asserts the SAME contract the .mjs gate checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. compile()×5 (react/vue/svelte/angular/solid — NO Lit, v1.0 per D-10) emits
 *      ZERO error-severity diagnostics + non-empty code.
 *   3. THE D-05/REQ-37 ACCEPTANCE CHECK: the emitted Svelte compiles clean under
 *      the repo's Svelte 5 compiler with NO `dollar_prefix_invalid` — proving the
 *      namespace-import convention holds across every authored source (spike 013).
 *
 * Pure GLUE over the @rozie/core public API + the Svelte compiler — no
 * compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { compile as svelteCompile } from 'svelte/compiler';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, '..', 'src');

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid'] as const;

function discoverSources(): string[] {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.rozie'))
    .sort();
}

const sources = discoverSources();

describe('@rozie-ui/lexical surface gate', () => {
  it('discovers at least the LexicalEditor shell source', () => {
    expect(sources).toContain('LexicalEditor.rozie');
  });

  describe.each(sources)('%s', (filename) => {
    const source = readFileSync(resolve(SRC_DIR, filename), 'utf8');

    it('lowerToIR emits zero error diagnostics', () => {
      const { ast } = parse(source, { filename });
      const { diagnostics = [] } = lowerToIR(ast, {
        modifierRegistry: createDefaultRegistry(),
      });
      const errs = diagnostics.filter((d: { severity: string }) => d.severity === 'error');
      expect(errs).toEqual([]);
    });

    it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
      const r = compile(source, { target, filename });
      const errs = r.diagnostics.filter((d: { severity: string }) => d.severity === 'error');
      expect(errs).toEqual([]);
      expect(r.code.length).toBeGreaterThan(0);
    });

    it('emitted Svelte compiles clean (D-05/REQ-37: no dollar_prefix_invalid)', () => {
      const r = compile(source, { target: 'svelte', filename });
      const name = filename.slice(0, -'.rozie'.length);
      // Throws on a Svelte compile error (dollar_prefix_invalid is a hard error in
      // Svelte 5) — the assertion is that this does NOT throw.
      const result = svelteCompile(r.code, { generate: 'client', filename: `${name}.svelte` });
      const dollarPrefix = (result.warnings ?? []).filter((w: { code?: string }) =>
        String(w.code ?? '').includes('dollar_prefix'),
      );
      expect(dollarPrefix).toEqual([]);
    });
  });
});

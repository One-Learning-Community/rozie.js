/**
 * regression-destructuring-shadow — Bug 1 (Angular), quick task 260520-gi1.
 *
 * RATIONALE / why this gap existed:
 *   The Angular class emitter promotes top-level script bindings (`const`
 *   arrows, `function` decls, and plain `let editor = null`) to class members
 *   and rewrites every bare reference into `this.<name>`. A destructured
 *   PARAMETER that shadows a promoted name — e.g. TipTap.rozie's
 *   `onUpdate: ({ editor }) => …` shadowing the script-scope `let editor` —
 *   was being rewritten into the illegal binding pattern
 *   `({ editor: this.editor }) => …`, which @babel/parser rejects with
 *   "Binding member expression." esbuild rejects it at bundle time, but
 *   `compile()` produced NO ROZ diagnostic.
 *
 *   The existing core/tests/engine-examples.compile.test.ts only asserts
 *   `compile()` diagnostics — it never bundles or PARSES the emitted code.
 *   That is the coverage gap this spec closes: it parses the emitted Angular
 *   source with @babel/parser and fails loudly if it is syntactically invalid.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitAngular(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry })
    .code;
}

describe('Bug 1 (Angular) — scope-aware identifier rewrite', () => {
  it('TipTap.rozie emit contains no illegal `{ editor: this.editor }` binding pattern', () => {
    const code = compile('TipTap');
    expect(code).not.toMatch(/editor:\s*this\.editor/);
  });

  it('TipTap.rozie emit parses cleanly via @babel/parser', () => {
    const code = compile('TipTap');
    expect(() =>
      babelParse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      }),
    ).not.toThrow();
  });

  it('still rewrites genuine bare references to `this.editor`', () => {
    const code = compile('TipTap');
    expect(code).toMatch(/this\.editor\b/);
  });
});

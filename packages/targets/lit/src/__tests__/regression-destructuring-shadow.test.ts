/**
 * regression-destructuring-shadow — Bug 1 (Lit), quick task 260520-gi1.
 *
 * RATIONALE / why this gap existed:
 *   The Lit class emitter promotes top-level script bindings (`const` arrows,
 *   `function` decls, and plain `let editor = null`) to class fields and
 *   rewrites every bare reference into `this.<name>`. A destructured PARAMETER
 *   that shadows a promoted name — e.g. TipTap.rozie's
 *   `onUpdate: ({ editor }) => …` shadowing the script-scope `let editor` —
 *   was being rewritten into the illegal binding pattern
 *   `({ editor: this.editor }) => …`, which @babel/parser rejects with
 *   "Binding member expression." esbuild rejects it at bundle time, but
 *   `compile()` produced NO ROZ diagnostic.
 *
 *   The existing core/tests/engine-examples.compile.test.ts only asserts
 *   `compile()` diagnostics — it never bundles or PARSES the emitted code.
 *   That is the coverage gap this spec closes: it parses the emitted Lit
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
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

// TipTap.rozie graduated into @rozie-ui/tiptap (Phase 32 git-mv); resolve it from
// the package src. Other named examples still live under examples/.
const PKG_SRC: Record<string, string> = {
  TipTap: 'packages/ui/tiptap/src/TipTap.rozie',
};

function compile(name: string): string {
  const source = readFileSync(
    resolve(ROOT, PKG_SRC[name] ?? `examples/${name}.rozie`),
    'utf8',
  );
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('Bug 1 (Lit) — scope-aware identifier rewrite', () => {
  it('TipTap.rozie emit contains no illegal `{ editor: this.editor }` binding pattern', () => {
    const code = compile('TipTap');
    // The destructured PARAM `({ editor }) => …` must stay a shorthand binding;
    // rewriting it to `({ editor: this.editor }) =>` is the illegal pattern (an
    // object-PATTERN can't bind to a member expression). The regex is scoped to
    // the arrow-PARAMETER form (object close `})` immediately before `=>`) so a
    // legitimate value-position object LITERAL — e.g. the portal scope
    // `$portals.toolbar(node, { editor })` → `{ editor: this.editor }`, correct
    // codegen — does NOT trip the guard. The `parses cleanly via @babel/parser`
    // test below is the strong backstop (the illegal arrow-param form is a syntax
    // error).
    expect(code).not.toMatch(/editor:\s*this\.editor\s*\}\s*\)\s*=>/);
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

  it('still emits `editor = null` as a class field (promotion preserved)', () => {
    const code = compile('TipTap');
    // `: any` is added by typeNeutralizeScript — `let editor = null` would
    // otherwise type the field `null` and reject `this.editor = new Editor()`.
    expect(code).toMatch(/\beditor(?::\s*any)?\s*=\s*null/);
  });

  it('still rewrites genuine bare references to `this.editor`', () => {
    const code = compile('TipTap');
    // e.g. `this.editor.getHTML()` inside the onUpdate body.
    expect(code).toMatch(/this\.editor\b/);
  });
});

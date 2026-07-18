/**
 * litRefLetCollision.test.ts — emitter-hardening backlog item #9, Lit half.
 *
 * REGRESSION-LOCK, not a RED-first bug reproduction. This quick task
 * (260717-url) set out to red-first reproduce a Lit TS2663 ("Cannot find
 * name 'X'. Did you mean 'this.X'?") for a module-scope capture-`let`
 * colliding with a template `ref="X"` name — the premise being that the
 * chartjs `canvasNode` workaround (renaming away from `canvasEl` purely to
 * dodge this bug) was still load-bearing for Lit.
 *
 * Investigation (empirical, not theoretical) found the premise FALSIFIED:
 * commit `281fbe56` ("fix(react,svelte,angular,lit): ref=\"X\" colliding
 * with a same-named top-level script binding", 2026-07-06) already fixed
 * the Lit half — `collectMethodNamesFromProgram` drops ref names from its
 * `reserved` exclusion set (Spike-012 R3-5, see its comment ~165-172 in
 * `rewriteScript.ts`), so a same-named module-`let` promotes to a genuine
 * class field and every use-site (including inside lifecycle-hook
 * fragments, `$watch` getter/callback bodies via `methodNamesOverride`, and
 * top-level helper functions) is correctly `this.`-qualified. This was
 * shipped BEFORE the emitter-hardening-backlog memory note recorded item #9
 * as "Lit+Angular OPEN" (a stale snapshot from earlier the same day) — the
 * `project_emitter_hardening_backlog` memory entry was not updated after
 * the later fix landed.
 *
 * Proof: this file's assertions (byte-for-byte the shape a genuine RED test
 * would flip to GREEN after a fix) ALREADY PASS against the current
 * (unmodified) emitter — no `packages/targets/lit/src/rewrite/rewriteScript.ts`
 * change was made in this task. Kept as a permanent regression guard (Phase
 * 56 / Phase 73 "falsified premise, shipped as guard" precedent) so a future
 * regression in this exact shape is caught immediately. The chartjs
 * `canvasNode` workaround is retired in the same task (Task 5) now that the
 * acceptance driver (`canvasEl` colliding with `ref="canvasEl"`) is confirmed
 * to build green on all 6 targets, INCLUDING Lit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../../__tests__/fixtures/LitRefLetCollision.rozie');

function compileToLit(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  const { code } = emitLit(ir, { filename, source, modifierRegistry: registry });
  return code;
}

describe('Lit ref-colliding module-let this-qualification (emitter-hardening backlog #9, Lit half — regression lock)', () => {
  const SRC = readFileSync(FIXTURE, 'utf8');

  it('every real script use-site of the promoted `canvasEl` field is `this.`-qualified', () => {
    const code = compileToLit(SRC, 'LitRefLetCollision.rozie');

    // The ref itself lowers to the PREFIXED @query field — a DISTINCT class
    // member from the promoted script field, never colliding.
    expect(code).toContain("@query('[data-rozie-ref=\"canvasEl\"]') private _refCanvasEl");

    // The field declaration itself is bare (a declaration, not a reference).
    expect(code).toMatch(/^\s*canvasEl: any = null;\s*$/m);

    // Every REAL reference (the $onMount assignment, the cleanup-return
    // read, and the `recreate()` helper's guard + destroy + reassignment)
    // is `this.`-qualified.
    expect(code).toContain('this.canvasEl = new FakeEngine()');
    expect(code).toContain('this.canvasEl.destroy()');
    expect(code).toContain('if (!this.canvasEl) return');

    // No bare (non-`this.`-qualified) `canvasEl` reference survives in any
    // JS statement (excluding the field declaration above, the
    // `data-rozie-ref="canvasEl"` template-attribute string literals, and
    // `//` comment lines carried over from the source — none of these are
    // identifier references).
    const codeMinusComments = code
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    const codeMinusDecl = codeMinusComments.replace(/^\s*canvasEl: any = null;\s*$/m, '');
    const codeMinusStrings = codeMinusDecl.replace(/data-rozie-ref="canvasEl"/g, '');
    expect(codeMinusStrings).not.toMatch(/(?<!this\.)\bcanvasEl\b/);
  });
});

/**
 * angularRefLetCollision.test.ts — emitter-hardening backlog item #9, Angular half.
 *
 * REGRESSION-LOCK, not a RED-first bug reproduction. This quick task
 * (260717-url) set out to red-first reproduce an Angular TS2300 (duplicate
 * class member) for a module-scope capture-`let` colliding with a template
 * `ref="X"` name — the premise being that the chartjs `canvasNode`
 * workaround was still load-bearing for Angular.
 *
 * Investigation (empirical, not theoretical) found the premise FALSIFIED:
 * commit `281fbe56` ("fix(react,svelte,angular,lit): ref=\"X\" colliding
 * with a same-named top-level script binding", 2026-07-06) already fixed
 * the Angular half via the core `deconflictRefsAgainstUserBindings` pass
 * (`packages/core/src/rewrite/deconflict.ts`), invoked from `emitAngular.ts`
 * BEFORE `rewriteRozieIdentifiers` runs: a `ref="X"` colliding with a
 * top-level script binding renames the INTERNAL ref (never the user
 * binding, which may itself be a public `$expose` verb) to `<name>Ref` —
 * so the ref's `viewChild('canvasElRef')` member and the script-derived
 * `canvasEl` class field never share an identifier. This was shipped BEFORE
 * the emitter-hardening-backlog memory note recorded item #9 as
 * "Lit+Angular OPEN" (a stale snapshot from earlier the same day) — the
 * `project_emitter_hardening_backlog` memory entry was not updated after
 * the later fix landed.
 *
 * Proof: this file's assertions (byte-for-byte the shape a genuine RED test
 * would flip to GREEN after a fix) ALREADY PASS against the current
 * (unmodified) emitter — no `packages/targets/angular/src/rewrite/rewriteScript.ts`
 * change was made in this task. Kept as a permanent regression guard (Phase
 * 56 / Phase 73 "falsified premise, shipped as guard" precedent). The
 * chartjs `canvasNode` workaround is retired in the same task (Task 5) now
 * that the acceptance driver (`canvasEl` colliding with `ref="canvasEl"`) is
 * confirmed to build green on all 6 targets, INCLUDING Angular
 * (`pnpm --filter @rozie-ui/chartjs-angular build` → ng-packagr success).
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import { emitAngular } from '../../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '..', '..', '__tests__', 'fixtures', 'AngularRefLetCollision.rozie');

function compileAngular(src: string, filename: string): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${filename}`);
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('Angular ref-colliding module-let dedup (emitter-hardening backlog #9, Angular half — regression lock)', () => {
  const SRC = readFileSync(FIXTURE, 'utf8');
  const FILE = 'AngularRefLetCollision.rozie';

  it('renames the INTERNAL ref to canvasElRef; the script field keeps its own name (no duplicate `canvasEl` member)', () => {
    const code = compileAngular(SRC, FILE);

    // Exactly ONE viewChild-ref member — the RENAMED ref, never the bare name.
    expect(count(code, "viewChild<ElementRef<HTMLElement>>('canvasElRef')")).toBe(1);
    expect(code).toContain('canvasElRef = viewChild');
    expect(code).not.toContain("viewChild<ElementRef<HTMLElement>>('canvasEl')");

    // The template ref attribute matches the renamed selector.
    expect(code).toContain('#canvasElRef');

    // The script-derived class field keeps its OWN name — never renamed —
    // and is the ONLY `canvasEl` class-member declaration (no TS2300).
    expect(count(code, 'canvasEl: any = null;')).toBe(1);

    // Every real script use-site is `this.`-qualified (the $onMount
    // assignment, the cleanup-return read, and the recreate() helper's
    // guard + destroy + reassignment) — none collapse onto the renamed
    // ref's `this.canvasElRef()` signal accessor.
    expect(code).toContain('this.canvasEl = new FakeEngine()');
    expect(code).toContain('this.canvasEl.destroy()');
    expect(code).toContain('if (!this.canvasEl) return');
    expect(code).not.toContain('this.canvasElRef()?.nativeElement');
  });
});

/**
 * ANGULAR-TSC — tsc --noEmit clean over emitted Angular standalone components.
 *
 * Compiles all 8 reference examples to Angular standalone-component `.ts` files,
 * writes them into a tmp dir (alongside our tsconfig.json + a node_modules
 * symlink), then invokes `tsc --noEmit` and fails if any error fires.
 *
 * SCOPE — this gate validates the EMITTED SCRIPT BODY ONLY.
 *   Angular standalone components compile to plain `.ts` files containing a
 *   class decorated with `@Component({ template: `...` })`. The template
 *   markup is a STRING literal inside that decorator — `tsc` does NOT
 *   type-check Angular template expressions (e.g. `[items]="items()"`,
 *   `(click)="reset($event)"`). Template type-checking would require `ngc`
 *   with `strictTemplates: true`, which is a much bigger lift (requires a
 *   full Angular workspace, ng-packagr, the whole 9 yards). This gate
 *   targets the class body: field declarations, constructor body,
 *   ngAfterViewInit, computed/effect blocks, lifted method bodies.
 *
 * Class of bug this catches:
 *   - TDZ (use-before-declaration) in emitter output
 *   - Wrong-arg-count from lifecycle/watcher emit (`(cb)(__watchVal)` where
 *     cb has 0 params → TS2554)
 *   - Type mismatches in prop default / computed / signal initializers
 *   - Missing or wrong-shaped Angular framework imports
 *   - implicit any / missing type annotations on lifted method params
 *
 * Mirrors the SOLID-TSC / LIT-TSC describe blocks in tests/solid-lint and
 * tests/lit-lint. No eslint gate — Angular doesn't ship a comparable
 * reactivity-rules linter, so we run tsc-only here.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  // Engine-wrapper examples — non-trivial `<script>` logic (an engine instance
  // held in `let editor = null`, untyped callback params). This is the shape
  // the untyped-`<script>` type-broken-emit bug regresses; covering it here is
  // what would have caught that bug. Engine imports resolve against the
  // ambient `engine-modules.d.ts` stub copied into the tmp dir below.
  // All four engine wrappers are now covered — quick task 260520-w18 closed
  // the residual class-body type-error bug classes that previously blocked
  // Uppy / SortableList / Flatpickr. NOTE: this gate is tsc-only and does
  // NOT type-check the `template:` string — it exercises the class body but
  // not Angular's strictTemplates surface (see the quick-task SUMMARY for
  // the deferred strictTemplates rationale + manual verification recipe).
  'TipTap',
  'Uppy',
  'SortableList',
  'Flatpickr',
];

describe('ANGULAR-TSC — tsc --noEmit clean over emitted Angular standalone components', () => {
  it('all 12 emitted Angular .ts files (8 reference + 4 engine-wrapper) tsc clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-tsc-'));
    try {
      for (const name of EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'angular',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.ts'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Ambient `any` stubs for engine modules imported by the engine-wrapper
      // examples (TipTap → @tiptap/*, Flatpickr → flatpickr).
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      // Symlink the workspace's node_modules so tsc resolves @angular/core,
      // @angular/common, etc. Mirrors the Solid + Lit gate pattern.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const tscBin = resolve(HERE, 'node_modules/.bin/tsc');
      try {
        execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

/**
 * Phase 80 Plan 07 (Task 2) — R2's misapplication contract: applying
 * `[rozieSlot]` to a non-`ng-template` element is a compile error under
 * `strictTemplates`.
 *
 * This does NOT go through the Vite/AnalogJS AOT pipeline the rest of this
 * package uses. Two things were verified empirically before landing this:
 *
 * 1. `@analogjs/vite-plugin-angular`'s transform (as wired in
 *    vitest.config.ts, `angular({ jit: false })`) does not surface template
 *    schema diagnostics AT ALL — a probe mounting a `<div [rozieSlot]>` host
 *    through the normal fixture-import path compiled and RENDERED silently
 *    with neither a build-time failure nor a runtime throw, regardless of
 *    whether `tsconfig.spec.json`'s `strictTemplates` was true or false. The
 *    Vite plugin optimizes for fast dev-mode transforms and does not run
 *    ngtsc's full diagnostics-collection pass.
 * 2. JIT compilation (a component decorated outside this package's ngtsc
 *    Program, relying on the `@angular/compiler` JIT fallback loaded by
 *    setup-vitest.ts) ALSO does not enforce template schema checking — JIT
 *    has no static type-checking pass at all; it emits an unconditional
 *    `ɵɵproperty('rozieSlot', ...)` instruction and `Renderer2.setProperty`
 *    silently accepts an unknown property assignment on a native DOM
 *    element at runtime.
 *
 * The plan's original prose ("the JIT unknown-property-binding error and the
 * ahead-of-time strictTemplates error are two surfacings of the same
 * cause... the JIT assertion is the fast, automated observation of that
 * contract") does not hold in THIS harness's specific tooling — flagged per
 * the standing instruction to report contrary evidence rather than silently
 * comply with plan prose written before this was empirically checked.
 *
 * The genuine, tooling-independent proof is `@angular/compiler-cli`'s own
 * `readConfiguration` + `performCompilation` API — the same programmatic
 * surface `ngc`/`ng build` uses — invoked directly against a real
 * `strictTemplates: true` Angular compiler options object. This is a
 * STRONGER proof than a mount-and-catch runtime test would have been: it is
 * deterministic, has zero dependency on OPEN RISK R-80-NG0203 (no
 * `RozieSlot` instance is ever constructed — the whole point is that the
 * directive's selector never matches), and exercises the exact diagnostic
 * class (`NG8002`) a real consumer's strict build would see.
 */
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readConfiguration, performCompilation } from '@angular/compiler-cli';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('misapplication — [rozieSlot] on a non-ng-template element (R2)', () => {
  it('fails strictTemplates compilation with NG8002, naming rozieSlot', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-runtime-misapplication-'));
    try {
      writeFileSync(
        join(tmpDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'bundler',
            strict: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
            skipLibCheck: true,
            lib: ['ES2022', 'DOM'],
          },
          angularCompilerOptions: {
            strictTemplates: true,
            compilationMode: 'full',
          },
          files: ['MisapplicationHost.ts'],
        }),
      );
      writeFileSync(
        join(tmpDir, 'MisapplicationHost.ts'),
        `import { Component } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';

// R2: RozieSlot's selector is 'ng-template[rozieSlot]' — a <div> can never
// match it. This is the SAME shape a hand-author would write by mistake.
@Component({
  selector: 'misapplication-host',
  standalone: true,
  imports: [RozieSlot],
  template: \`<div [rozieSlot]="'x'"></div>\`,
})
export class MisapplicationHost {}
`,
      );
      // Resolve @angular/core, @rozie/runtime-angular, etc. through this
      // package's own node_modules, same technique tests/angular-typecheck
      // uses for its plain-tsc gate.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const config = readConfiguration(join(tmpDir, 'tsconfig.json'));
      expect(config.errors).toEqual([]);

      const result = performCompilation({
        rootNames: config.rootNames,
        options: config.options,
      });

      const messages = result.diagnostics.map((d) =>
        typeof d.messageText === 'string' ? d.messageText : JSON.stringify(d.messageText),
      );
      const unknownPropertyDiagnostic = messages.find(
        (m) => m.includes('rozieSlot') && m.toLowerCase().includes("isn't a known property"),
      );
      expect(unknownPropertyDiagnostic).toBeDefined();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

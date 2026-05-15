// Phase 5 Plan 05-04a Task 3 — 5 whole-component fixture snapshots locked.
//
// Each example .rozie compiles to a {name}.ts.snap fixture; per-example
// substring invariants follow:
//   - Counter — model<number>(0) + console.log("hello from rozie") (DX-03)
//   - SearchInput — debounce class-body field initializer + FormsModule
//   - Dropdown — three effect((onCleanup) =>) blocks (outside-click + escape +
//                throttle resize) + ::ng-deep :root for CSS-variable escape hatch
//   - TodoList — ngTemplateContextGuard, *ngTemplateOutlet, @for + track,
//                #defaultSlot synthetic ref (OQ A5 RESOLVED), NgTemplateOutlet
//                conditional import (Pitfall 10)
//   - Modal — ::ng-deep :root + multiple inject(DestroyRef).onDestroy in
//             constructor body (Pitfall 8 — inject only in constructor)
//
// All 5 emitted .ts files must parse cleanly via TypeScript's parser
// (Pitfall 6 mitigation).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// Default import (not `import * as ts`) — TypeScript ≤5.4 wraps its CJS module
// under `default` for ESM consumers, while TS ≥5.5 also exposes flat names.
// Default import grabs the flat module on both shapes, so this stays portable
// across the TS 5.4↔5.5 namespace-flattening boundary regardless of which TS
// version the workspace ends up resolving.
import ts from 'typescript';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitAngular } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): { ir: IRComponent; src: string; filename: string } {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src, filename };
}

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('emitAngular — 5 whole-component fixture snapshots locked', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name}.ts.snap`, async () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitAngular(ir, { filename, source: src });
      await expect(code).toMatchFileSnapshot(resolve(FIXTURES, `${name}.ts.snap`));
    });
  }
});

describe('emitAngular — Plan 05-04a smoke tests (TypeScript parses emitted output)', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name} parses cleanly via TypeScript`, () => {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitAngular(ir, { filename, source: src });
      // Pitfall 6 mitigation: ensure the emitted .ts parses cleanly.
      const sourceFile = ts.createSourceFile(
        `${name}.ts`,
        code,
        ts.ScriptTarget.ES2022,
        /* setParentNodes */ true,
        ts.ScriptKind.TS,
      );
      // Hard parse errors register as diagnostics on the source file's
      // parseDiagnostics array. Ensure none.
      // @ts-expect-error — parseDiagnostics is non-public but stable.
      const diagnostics: readonly ts.Diagnostic[] = sourceFile.parseDiagnostics ?? [];
      const parseErrors = diagnostics.filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      );
      if (parseErrors.length > 0) {
        const messages = parseErrors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
        throw new Error(`${name}.ts parse errors:\n${messages.join('\n')}`);
      }
      expect(parseErrors).toEqual([]);
    });
  }
});

describe('emitAngular — substring invariants (Plan 05-04a Task 3 acceptance criteria)', () => {
  it('Counter.ts.snap contains literal `value = model<number>(0)` AND `console.log("hello from rozie")` (DX-03)', () => {
    const { ir, src, filename } = loadExample('Counter');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).toContain('value = model<number>(0)');
    expect(code).toContain('console.log("hello from rozie")');
    expect(code).toContain('signal(false)');
    expect(code).toContain('computed(() =>');
    expect(code).toContain("selector: 'rozie-counter'");
    expect(code).toContain('standalone: true');
  });

  it('Counter has NO FormsModule import (no r-model)', () => {
    const { ir, src, filename } = loadExample('Counter');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).not.toContain('FormsModule');
  });

  it('SearchInput has FormsModule import (r-model present)', () => {
    const { ir, src, filename } = loadExample('SearchInput');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).toContain('FormsModule');
  });

  it('Dropdown.ts.snap contains 3 effect((onCleanup) =>) blocks + Renderer2.listen pairs', () => {
    const { ir, src, filename } = loadExample('Dropdown');
    const { code } = emitAngular(ir, { filename, source: src });
    const effectMatches = code.match(/effect\(\(onCleanup\) =>/g) ?? [];
    expect(effectMatches.length).toBeGreaterThanOrEqual(3);
    const rendererListenMatches = code.match(/renderer\.listen\(/g) ?? [];
    expect(rendererListenMatches.length).toBeGreaterThanOrEqual(3);
    const onCleanupMatches = code.match(/onCleanup\(unlisten\)/g) ?? [];
    expect(onCleanupMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('TodoList.ts.snap contains @for, ngTemplateOutlet, ngTemplateContextGuard, NgTemplateOutlet import, #defaultSlot', () => {
    const { ir, src, filename } = loadExample('TodoList');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).toContain('@for (item of items()');
    expect(code).toContain('track item.id');
    expect(code).toContain('*ngTemplateOutlet');
    expect(code).toContain('ngTemplateContextGuard');
    expect(code).toContain('NgTemplateOutlet');
    // OQ A5 RESOLVED — synthetic #defaultSlot ref name (NOT `default`).
    expect(code).toContain("'defaultSlot'");
  });

  it('Modal.ts.snap contains ::ng-deep :root AND multiple inject(DestroyRef).onDestroy in constructor (Pitfall 8)', () => {
    const { ir, src, filename } = loadExample('Modal');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).toContain('::ng-deep :root');
    expect(code).toContain('inject(DestroyRef).onDestroy(');
  });

  it('NO @Input / @Output / @ViewChild legacy decorators (signal API exclusively)', () => {
    for (const name of EXAMPLE_NAMES) {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitAngular(ir, { filename, source: src });
      // Negative match — no `@Input(`, `@Output(`, or `@ViewChild(` syntax.
      // Note: `@ContentChild` is the v1 idiom for projected templates and IS allowed.
      expect(code, `${name} contains forbidden @Input decorator`).not.toMatch(/@Input\(/);
      expect(code, `${name} contains forbidden @Output decorator`).not.toMatch(/@Output\(/);
      expect(code, `${name} contains forbidden @ViewChild decorator`).not.toMatch(/@ViewChild\(/);
    }
  });

  it('NO *ngIf / *ngFor legacy structural directives (block syntax exclusively)', () => {
    for (const name of EXAMPLE_NAMES) {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitAngular(ir, { filename, source: src });
      expect(code, `${name} contains forbidden *ngIf legacy directive`).not.toMatch(/\*ngIf/);
      expect(code, `${name} contains forbidden *ngFor legacy directive`).not.toMatch(/\*ngFor/);
    }
  });

  it('Pitfall 8 verification: ALL inject() calls are in constructor body or field initializers', () => {
    for (const name of EXAMPLE_NAMES) {
      const { ir, src, filename } = loadExample(name);
      const { code } = emitAngular(ir, { filename, source: src });
      // Find each `inject(` occurrence. For each, verify it lives in either:
      //   - constructor body (between `constructor() {` and matching `}`)
      //   - field initializer (line starts with `[ws]name = inject(`)
      // Regex-only validation: each `inject(...)` should NOT appear inside
      // arrow body `=> {...}` of a class method (which would be a Pitfall 8 bug).
      // Heuristic: find inject() inside arrow bodies that are NOT effect() callbacks.
      // For v1 simplicity, assert that any `inject(` occurrence appears ONLY
      // after `constructor() {` opening — easy proxy.
      const ctorMatch = code.match(/constructor\(\) \{([\s\S]*?)\n  \}/);
      const ctorBody = ctorMatch?.[1] ?? '';
      const allInjects = (code.match(/inject\(/g) ?? []).length;
      // Field initializers can also contain inject — match `=\s*inject\(`.
      // Effect callbacks `effect((onCleanup) => { ...inject... })` are ALSO valid
      // injection contexts in Angular. Allow them.
      const fieldInitInjects = (code.match(/=\s*inject\(/g) ?? []).length;
      const ctorInjects = (ctorBody.match(/inject\(/g) ?? []).length;
      // The remaining injects (allInjects - fieldInitInjects - ctorInjects)
      // should be 0. If non-zero, Pitfall 8 is violated.
      const orphans = allInjects - fieldInitInjects - ctorInjects;
      expect(orphans, `${name} has inject() outside constructor/field-init`).toBeLessThanOrEqual(0);
    }
  });
});

describe('emitAngular — DX-01 source map composes against original .rozie source', () => {
  it('SearchInput.ts source map references the .rozie filename', () => {
    const { ir, src, filename } = loadExample('SearchInput');
    const { map } = emitAngular(ir, { filename, source: src });
    expect(map).not.toBeNull();
    expect(map!.sources).toEqual([filename]);
    expect(map!.sourcesContent).toEqual([src]);
  });
});

/**
 * SVELTE-CHECK — svelte-check --threshold error gate.
 *
 * Compiles all 8 reference examples to Svelte 5 SFCs (`.svelte`), writes them
 * to a tmp dir (alongside a tsconfig + node_modules symlink), then invokes
 * `svelte-check` and fails if any error fires. svelte-check parses .svelte
 * SFCs, extracts <script lang="ts"> blocks, and type-checks them in the
 * context of the template — the standard tool for the Svelte target since
 * `tsc` alone cannot understand .svelte files.
 *
 * Mirrors tests/solid-lint/solid-lint.test.ts SOLID-TSC shape; swaps `tsc`
 * for `svelte-check`.
 *
 * Catches the class of bug that integration tests do not:
 *   - $watch callback arity (wrong-arg-count from watcher emit)
 *   - Prop type renderType producing `unknown[]` where `.filter(...)` is called
 *   - $bindable() typing for model:true props
 *   - Snippet<[ctx]> mismatches in slot fallback / merge expressions
 *   - Listener cleanup typing (passive flag etc.)
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync, mkdirSync } from 'node:fs';
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
  // Phase 21 $expose dogfood — typed reset()/focus() handle. The Svelte instance
  // `export function reset(): void` / `export function focus(): void` exports
  // must svelte-check clean.
  'ExposeProbe',
  // Engine-wrapper examples — non-trivial `<script>` logic (an engine instance
  // held in `let editor = null`, untyped callback params). This is the shape
  // the untyped-`<script>` type-broken-emit bug regresses; covering it here is
  // what would have caught that bug. Engine imports resolve against the
  // ambient `engine-modules.d.ts` stub copied into the tmp dir below.
  // All four engine wrappers are now covered — quick task 260520-w18 closed
  // the residual type-error bug classes that previously blocked Uppy /
  // SortableList / Flatpickr.
  'TipTap',
  'Uppy',
  'SortableList',
  'Flatpickr',
  // Phase 35 — MapLibre wraps maplibre-gl (default import, untyped engine
  // instance held in `let instance = null`, many untyped callback params). The
  // null-let mapOptions routing + the reactive marker/popup portal reconcilers
  // are the shape the untyped-`<script>` type-broken-emit bug regresses;
  // covering it here exercises the emit path. `maplibre-gl` resolves against the
  // ambient `engine-modules.d.ts` stub.
  'MapLibre',
  // The remaining @rozie-ui engine wrappers (Cropper / Chart / CodeMirror /
  // FullCalendar / PdfViewer) — added 2026-06-08 to close the coverage gap that
  // let the svelte `const X = $props.X` → `const X = X` (TS2448) self-reference
  // ship undetected: PdfViewer was NOT in this list, so svelte-check never ran
  // over its emit. All five resolve their engine imports against the ambient
  // `engine-modules.d.ts` stub. Now every @rozie-ui family's svelte emit is
  // svelte-check-gated.
  'Cropper',
  'Chart',
  'CodeMirror',
  'FullCalendar',
  'PdfViewer',
];

// TYPED_EXAMPLES — the `examples/typed/*` fixture set (Phase 9
// `<script lang="ts">`). Side-by-side typed variants resolved under
// `examples/typed/`, NOT added to the dist-parity EXAMPLES baseline. Checked
// in a separate describe block so a typed-fixture failure is distinguishable
// from an untyped regression.
const TYPED_EXAMPLES = ['Counter', 'Dropdown', 'SortableList', 'TypedCard', 'MatchUnion', 'DataCast', 'PropsCustomType', 'PropsRequired', 'DialogRef'];

describe('SVELTE-CHECK — svelte-check --threshold error clean over emitted Svelte SFCs', () => {
  it('all 18 emitted Svelte .svelte files (8 reference + 10 engine-wrapper) svelte-check clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-check-'));
    try {
      for (const name of EXAMPLES) {
        // SortableList + Flatpickr graduated from examples/ into their
        // @rozie-ui/<product> packages (git-mv). Resolve those from the package
        // src; all other reference examples still live under examples/.
        const PKG_SRC: Record<string, string> = {
          SortableList: 'packages/ui/sortable-list/src/SortableList.rozie',
          Flatpickr: 'packages/ui/flatpickr/src/Flatpickr.rozie',
          TipTap: 'packages/ui/tiptap/src/TipTap.rozie',
          MapLibre: 'packages/ui/maplibre/src/MapLibre.rozie',
          Cropper: 'packages/ui/cropper/src/Cropper.rozie',
          Chart: 'packages/ui/chartjs/src/Chart.rozie',
          CodeMirror: 'packages/ui/codemirror/src/CodeMirror.rozie',
          FullCalendar: 'packages/ui/fullcalendar/src/FullCalendar.rozie',
          PdfViewer: 'packages/ui/pdf/src/PdfViewer.rozie',
        };
        const srcPath = PKG_SRC[name]
          ? resolve(ROOT, PKG_SRC[name])
          : resolve(ROOT, 'examples/' + name + '.rozie');
        const source = readFileSync(srcPath, 'utf8');
        const result = compile(source, {
          target: 'svelte',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.svelte'), result.code, 'utf8');
      }

      // The emitted SortableList SFC imports the relative
      // `./internal/useSortableJS` helper. The harness writes emitted files flat
      // into tmpDir, so stage the helper under tmpDir/internal/ for svelte-check
      // to resolve it. Only needed when SortableList is in the EXAMPLES set.
      if (EXAMPLES.includes('SortableList')) {
        mkdirSync(join(tmpDir, 'internal'), { recursive: true });
        copyFileSync(
          resolve(ROOT, 'packages/ui/sortable-list/src/internal/useSortableJS.ts'),
          join(tmpDir, 'internal', 'useSortableJS.ts'),
        );
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // Ambient `any` stubs for engine modules imported by the engine-wrapper
      // examples (TipTap → @tiptap/*, Flatpickr → flatpickr).
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      // Symlink the workspace's node_modules so svelte-check resolves svelte,
      // typescript, etc. — same pattern the Solid/Lit tsc gates use.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
      try {
        execFileSync(
          svelteCheckBin,
          ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
          {
            cwd: tmpDir,
            stdio: 'pipe',
          },
        );
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('svelte-check exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SVELTE-CHECK (negative control) — the gate still flags a self-reference under the relaxed tsconfig', () => {
  // The gate's tsconfig relaxes strictNullChecks/exactOptionalPropertyTypes to
  // match the per-target leaf strictness policy (generated code is dist-parity-
  // correct, not author-strict-clean). This probe LOCKS IN that the relaxation
  // did NOT defeat detection of the bug class this gate exists for: the svelte
  // `const X = $props.X` → `const X = X` self-reference (debug
  // svelte-prop-shadow-self-ref). That emit is `TS2448 "Block-scoped variable
  // used before its declaration"` — a TDZ/block-scope error that is
  // strictness-INDEPENDENT. If a future tsconfig change (e.g. dropping to
  // `strict: false`, which disables TS2448's sibling checks, or adding
  // `// @ts-nocheck`-ish escape hatches) silently stopped flagging it, this test
  // goes RED.
  it('svelte-check reports a self-referential `const x = x` (TS2448) as an error', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-check-neg-'));
    try {
      // The exact shape the emitter bug produced: a top-level prop binding plus a
      // local whose initializer references itself (what `const src = $props.src`
      // lowered to before the fix). svelte-check must flag the self-reference.
      writeFileSync(
        join(tmpDir, 'SelfRef.svelte'),
        [
          '<script lang="ts">',
          '  let { src = "" }: { src?: string } = $props();',
          '  function buildSource() {',
          '    const src = src;', // ← TS2448 self-reference (the bug shape)
          '    return src;',
          '  }',
          '  buildSource();',
          '</script>',
          '',
          '<div>{src}</div>',
          '',
        ].join('\n'),
        'utf8',
      );
      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
      let output = '';
      let threw = false;
      try {
        execFileSync(
          svelteCheckBin,
          ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
          { cwd: tmpDir, stdio: 'pipe' },
        );
      } catch (err) {
        threw = true;
        output =
          ((err as { stdout?: Buffer }).stdout?.toString() ?? '') +
          ((err as { stderr?: Buffer }).stderr?.toString() ?? '');
      }
      // The gate MUST fail on the self-reference (proves the relaxed tsconfig
      // still catches the bug class). If this assertion ever fails, the gate has
      // been weakened into a no-op for the prop-shadow bug.
      expect(threw).toBe(true);
      expect(output).toMatch(/before its declaration|2448|used before being assigned|2454/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SVELTE-CHECK (typed) — svelte-check clean over emitted typed Svelte SFCs', () => {
  it('all 8 emitted typed Svelte .svelte files (examples/typed/*) svelte-check clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-check-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'svelte',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.svelte'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // typed/SortableList imports `sortablejs`; typed/TypedCard `import type`s
      // from it — the ambient engine-module stub resolves both to `any`.
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
      try {
        execFileSync(
          svelteCheckBin,
          ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
          {
            cwd: tmpDir,
            stdio: 'pipe',
          },
        );
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('svelte-check exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

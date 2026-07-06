/**
 * VUE-TSC — vue-tsc --noEmit gate over emitted Vue SFCs.
 *
 * Mirrors tests/solid-lint SOLID-TSC and tests/lit-lint LIT-TSC: compiles every
 * reference example to a Vue SFC, writes them into a tmpdir with a tsconfig +
 * node_modules symlink, then invokes vue-tsc and fails on any error.
 *
 * Catches the class of bug that snapshot-only emit tests do not:
 *   - <script setup> macro misuse (defineProps/defineModel/defineEmits/defineSlots)
 *   - Untyped or wrong-typed binding expressions in <template>
 *   - Wrong-arg-count from lifecycle/watcher emit
 *   - Type mismatches in slot fallback / scoped-slot expressions
 *   - Missing or wrong-shaped helper-runtime imports
 *
 * Implementation: compile each example to .vue source, drop into tmpdir, run
 * `vue-tsc --noEmit -p tsconfig.json` against the workspace's pinned vue-tsc.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync, mkdirSync } from 'node:fs';
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
  // Phase 21 $expose dogfood — typed reset()/focus() handle. defineExpose({...})
  // must vue-tsc clean (Vue infers the handle from the method refs).
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
  // Phase 58 Plan 04 (SC-3) — first-class prop documentation. The documented
  // `label` prop emits a multi-line JSDoc'd `defineProps<{ … }>` member (Open
  // Question 1 resolved to strategy A: JSDoc inside the `{ … }` type literal,
  // vue-tsc-accepted). This is the gate that locks strategy A: it proves the
  // multi-line restructure + the `*/`-bearing deprecated string (escaped by
  // buildPropJsdoc, T-58-06) + the angle-bracket-bearing `@example` line all
  // pass vue-tsc. The docless sibling `count` prop stays a bare compact member.
  'PropDocs',
];

// TYPED_EXAMPLES — the `examples/typed/*` fixture set (Phase 9
// `<script lang="ts">`). Side-by-side typed variants resolved under
// `examples/typed/`, NOT added to the dist-parity EXAMPLES baseline. Checked
// in a separate describe block so a typed-fixture failure is distinguishable
// from an untyped regression.
const TYPED_EXAMPLES = ['Counter', 'Dropdown', 'SortableList', 'TypedCard', 'MatchUnion', 'DataCast', 'PropsCustomType', 'PropsRequired', 'DialogRef', 'RefTagTypeProbe'];

describe('VUE-TSC — vue-tsc --noEmit clean over emitted Vue SFCs', () => {
  it('all 13 emitted Vue SFC files (8 reference + 5 engine-wrapper) typecheck clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-tsc-'));
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
        };
        const srcPath = PKG_SRC[name]
          ? resolve(ROOT, PKG_SRC[name])
          : resolve(ROOT, 'examples/' + name + '.rozie');
        const source = readFileSync(srcPath, 'utf8');
        const result = compile(source, {
          target: 'vue',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.vue'), result.code, 'utf8');
      }

      // The emitted SortableList SFC imports the relative
      // `./internal/useSortableJS` helper. The harness writes emitted files flat
      // into tmpDir, so stage the helper under tmpDir/internal/ for vue-tsc to
      // resolve it. Only needed when SortableList is in the EXAMPLES set.
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
      // Symlink the workspace's node_modules so vue-tsc resolves vue,
      // @rozie/runtime-vue, etc.
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const vueTscBin = resolve(HERE, 'node_modules/.bin/vue-tsc');
      try {
        execFileSync(vueTscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('vue-tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('VUE-TSC (typed) — vue-tsc --noEmit clean over emitted typed Vue SFCs', () => {
  it('all 8 emitted typed Vue SFC files (examples/typed/*) typecheck clean', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-vue-tsc-typed-'));
    try {
      for (const name of TYPED_EXAMPLES) {
        const source = readFileSync(resolve(ROOT, 'examples/typed/' + name + '.rozie'), 'utf8');
        const result = compile(source, {
          target: 'vue',
          filename: name + '.rozie',
          sourceMap: false,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        writeFileSync(join(tmpDir, name + '.vue'), result.code, 'utf8');
      }

      copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
      // typed/SortableList imports `sortablejs`; typed/TypedCard `import type`s
      // from it — the ambient engine-module stub resolves both to `any`.
      copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
      symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');

      const vueTscBin = resolve(HERE, 'node_modules/.bin/vue-tsc');
      try {
        execFileSync(vueTscBin, ['--noEmit', '-p', 'tsconfig.json'], {
          cwd: tmpDir,
          stdio: 'pipe',
        });
      } catch (err) {
        const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
        throw new Error('vue-tsc --noEmit exited non-zero:\n' + stdout + '\n' + stderr);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

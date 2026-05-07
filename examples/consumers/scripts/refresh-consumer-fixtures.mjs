#!/usr/bin/env node
/**
 * Refresh compiled fixtures for `examples/consumers/{target}-ts/` projects.
 *
 * Usage: `node examples/consumers/scripts/refresh-consumer-fixtures.mjs`
 *
 * Per Plan 06-05 (Wave 4):
 *  1. For each target in [vue, react, svelte, angular]:
 *      - Build the 5 reference examples to `examples/consumers/{target}-ts/_dist/`
 *        via `runBuildMatrix` (the same coordinator behind `rozie build` — D-93).
 *      - Flatten the per-target subdir layout (`_dist/{target}/examples/*`) into
 *        `examples/consumers/{target}-ts/fixtures/` so consumer test.ts files
 *        can import via `./fixtures/Counter` rather than threading the
 *        D-89 `{target}/{rel}/` layout through every import path.
 *      - Discard `_dist/`.
 *  2. For React + Vue (TYPES-03 / D-85 full): synthesize Select<T> fixtures by
 *      calling `emitReactTypes(makeSelectIR(), { genericParams: ['T'] })` (React
 *      sibling .d.ts) and `emitVue(makeSelectIR(), { genericParams: ['T'] })`
 *      (full Vue SFC with `<script setup generic="T">`). The .rozie parser does
 *      not yet accept `generic="T"` per RESEARCH OQ2 RESOLVED, so the IR is
 *      manually constructed via `tests/fixtures/generics/select-ir.ts` (the
 *      same helper the type-emitter unit tests use — single source of truth).
 *
 * Bootstrap fail-safe: if `emitVue` returns errors OR doesn't emit
 * `generic="T"` in the SFC shell, the script aborts non-zero. This proves
 * Plan 06-02 Task 3 (D-85 Vue full) is in place before consumer fixtures bake.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBuildMatrix } from '@rozie/cli';
import { emitReactTypes } from '@rozie/target-react';
import { emitVue } from '@rozie/target-vue';

/**
 * Inline mirror of `tests/fixtures/generics/select-ir.ts`'s `makeSelectIR()`.
 *
 * Node ESM cannot directly import .ts files (no loader hook in v1 toolchain),
 * and we don't want to introduce tsx/ts-node here just for one helper. The IR
 * shape below is byte-identical to the .ts helper consumed by Plan 06-02's
 * unit tests at `packages/targets/{react,vue}/src/__tests__/`. Both the .ts
 * canon and this .mjs mirror are kept in lockstep — see SUMMARY for any
 * future refactor that consolidates them (e.g., emitting a shared .mjs or
 * adding a build step that compiles select-ir.ts to .mjs first).
 */
const ZERO_LOC = { start: 0, end: 0 };
function makeSelectIR() {
  return {
    type: 'IRComponent',
    name: 'Select',
    props: [
      {
        type: 'PropDecl',
        name: 'items',
        typeAnnotation: { kind: 'identifier', name: 'Array' },
        defaultValue: null,
        isModel: false,
        sourceLoc: ZERO_LOC,
      },
      {
        type: 'PropDecl',
        name: 'selected',
        typeAnnotation: { kind: 'identifier', name: 'T' },
        defaultValue: null,
        isModel: true,
        sourceLoc: ZERO_LOC,
      },
    ],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    setupBody: {
      type: 'SetupBody',
      scriptProgram: {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          directives: [],
          sourceType: 'module',
        },
      },
      annotations: [],
    },
    template: null,
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: ZERO_LOC,
    },
    sourceLoc: ZERO_LOC,
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const TARGETS = /** @type {const} */ (['vue', 'react', 'svelte', 'angular']);

const EXAMPLE_INPUTS = [
  resolve(ROOT, 'examples/Counter.rozie'),
  resolve(ROOT, 'examples/SearchInput.rozie'),
  resolve(ROOT, 'examples/Dropdown.rozie'),
  resolve(ROOT, 'examples/TodoList.rozie'),
  resolve(ROOT, 'examples/Modal.rozie'),
];

function logSection(message) {
  process.stdout.write(`\n[refresh-consumer-fixtures] ${message}\n`);
}

async function refreshTarget(target) {
  const consumerDir = resolve(ROOT, `examples/consumers/${target}-ts`);
  const fixturesDir = resolve(consumerDir, 'fixtures');
  const distDir = resolve(consumerDir, '_dist');

  logSection(`refreshing ${target}-ts → ${fixturesDir}`);

  // Wipe and re-create fixtures dir so stale outputs don't linger.
  rmSync(fixturesDir, { recursive: true, force: true });
  mkdirSync(fixturesDir, { recursive: true });
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Run the canonical CLI coordinator. `--out distDir` produces
  // `_dist/{target}/examples/Foo.{ext}` per D-89.
  await runBuildMatrix(
    EXAMPLE_INPUTS,
    {
      target: [target],
      out: distDir,
      types: true,
      sourceMap: false,
      root: ROOT,
    },
    { exit: 'throw' },
  );

  // Flatten _dist/{target}/examples/* → fixtures/*
  const flatSource = resolve(distDir, target, 'examples');
  if (!existsSync(flatSource)) {
    throw new Error(
      `[refresh-consumer-fixtures] ${target}: expected ${flatSource} to exist after runBuildMatrix; got nothing. Aborting.`,
    );
  }
  cpSync(flatSource, fixturesDir, { recursive: true });
  rmSync(distDir, { recursive: true, force: true });

  // For React only: the emitted .tsx files have a PRIVATE `interface FooProps`
  // (not exported); the typed contract — `export interface FooProps` plus
  // `declare function Foo(...): JSX.Element; export default Foo;` — lives in
  // the sibling .d.ts. With both files present, TypeScript's bundler module
  // resolution prefers the .tsx and the consumer's `import type { FooProps }`
  // fails. Drop the .tsx (and .module.css/.global.css runtime sidecars) so
  // module-resolution lands on the .d.ts — the load-bearing TYPES-02 artifact.
  // Vue/Svelte/Angular fixtures keep ALL emitted files because their typed
  // contract IS the .vue/.svelte/.ts source per D-84 (inline-typed targets).
  if (target === 'react') {
    const removed = pruneReactRuntimeArtifacts(fixturesDir);
    process.stdout.write(
      `[refresh-consumer-fixtures] react-ts: pruned ${removed} runtime artifact(s) so .d.ts resolution wins.\n`,
    );
  }
}

function pruneReactRuntimeArtifacts(dir) {
  let removed = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      removed += pruneReactRuntimeArtifacts(full);
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.module.css') || entry.endsWith('.global.css')) {
      rmSync(full);
      removed += 1;
    }
  }
  return removed;
}

async function emitReactSelect() {
  logSection('react-ts: emitting Select.d.ts via emitReactTypes (D-85 React full)');
  const selectIR = makeSelectIR();
  const dts = emitReactTypes(selectIR, { genericParams: ['T'] });
  if (!dts.includes('SelectProps<T>')) {
    throw new Error(
      "[refresh-consumer-fixtures] emitReactTypes did not include 'SelectProps<T>' — D-85 React full not landed. Aborting.",
    );
  }
  // No sibling runtime .tsx — the .d.ts is the load-bearing TYPES-03 artifact
  // and TS's bundler module resolution accepts `.d.ts` as a standalone module
  // when no `.ts`/`.tsx` shadow exists.
  const dtsPath = resolve(ROOT, 'examples/consumers/react-ts/fixtures/Select.d.ts');
  writeFileSync(dtsPath, dts);
}

async function emitVueSelect() {
  logSection('vue-ts: emitting Select.vue via emitVue + genericParams (D-85 Vue full)');
  const selectIR = makeSelectIR();
  const result = emitVue(selectIR, {
    genericParams: ['T'],
    filename: 'Select.rozie',
    source: '<rozie name="Select" />',
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    const summary = errors.map((d) => `[${d.code}] ${d.message}`).join('; ');
    throw new Error(
      `[refresh-consumer-fixtures] emitVue(Select, { genericParams: ['T'] }) returned ${errors.length} error(s): ${summary}. Aborting.`,
    );
  }
  if (!result.code.includes('generic="T"')) {
    throw new Error(
      "[refresh-consumer-fixtures] emitVue did not emit `generic=\"T\"` — Plan 06-02 Task 3 (D-85 Vue full) is not landed. Aborting.",
    );
  }
  const out = resolve(ROOT, 'examples/consumers/vue-ts/fixtures/Select.vue');
  writeFileSync(out, result.code);
}

async function main() {
  for (const target of TARGETS) {
    await refreshTarget(target);
  }
  await emitReactSelect();
  await emitVueSelect();
  logSection('done');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});

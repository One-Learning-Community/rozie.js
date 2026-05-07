// Happy-path + error-path tests for the `rozie build` subcommand.
//
// Strategy: drive runBuild() directly with `exit: 'throw'` so we don't have
// to spawn a child node. stdout/stderr are captured into string buffers via
// the ctx sinks. Tests cover all four shipped targets (vue, react, svelte,
// angular) plus the error paths (unknown target, ROZ-coded compile errors).
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BuildExit, runBuild, runBuildMany } from '../commands/build.js';

const COUNTER_PATH = resolve(__dirname, '../../../../examples/Counter.rozie');

function makeBufs() {
  let stdout = '';
  let stderr = '';
  return {
    ctx: {
      exit: 'throw' as const,
      stdoutWrite: (s: string) => {
        stdout += s;
      },
      stderrWrite: (s: string) => {
        stderr += s;
      },
    },
    out: () => stdout,
    err: () => stderr,
  };
}

describe('runBuild — happy path (Counter.rozie -> Vue SFC)', () => {
  it('emits a valid Vue 3 SFC with defineProps, defineModel, and computed()', async () => {
    const { ctx, out } = makeBufs();
    await runBuild(COUNTER_PATH, {}, ctx);
    const code = out();
    expect(code).toContain('<script setup lang="ts">');
    expect(code).toContain('defineProps');
    expect(code).toContain('defineModel');
    expect(code).toContain('computed(');
    // Sanity: the template block survived.
    expect(code).toContain('<template>');
    expect(code.trim().endsWith('</style>') || code.includes('</template>')).toBe(true);
  });
});

describe('runBuild — react target (Counter.rozie -> React TSX)', () => {
  // Phase 6 D-89/ROZ855: react target requires --out (sidecars cannot stream to stdout).
  // The test now uses a temp --out dir and reads the emitted Counter.tsx.
  it('emits a valid React 18 functional component with hooks + JSX + interface', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-react-'));
    const { ctx } = makeBufs();
    await runBuild(COUNTER_PATH, { target: 'react', out: tmp }, ctx);
    const candidates = [
      join(tmp, 'react', 'Counter.tsx'),
      join(tmp, 'react', 'examples', 'Counter.tsx'),
    ];
    const found = candidates.find((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBeDefined();
    const code = readFileSync(found!, 'utf8');
    // Sanity: NOT importing React default (D-68 automatic JSX runtime)
    expect(code).not.toContain("import React from 'react'");
    expect(code).toContain("from 'react'");
    expect(code).toContain('useControllableState');
    expect(code).toContain('interface CounterProps');
    expect(code).toContain('export default function Counter');
    expect(code).toContain('return (');
  });

  it('errors with ROZ855 when target=react and --out is omitted (sidecar safety)', async () => {
    const { ctx, err } = makeBufs();
    await expect(
      runBuild(COUNTER_PATH, { target: 'react' }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/ROZ855/);
    expect(err()).toMatch(/react/);
    expect(err()).toMatch(/--out|out/);
  });
});

describe('runBuild — svelte target (Counter.rozie -> Svelte 5 SFC)', () => {
  it('emits a Svelte 5 SFC with runes ($state/$derived/$bindable) and a default export', async () => {
    const { ctx, out } = makeBufs();
    await runBuild(COUNTER_PATH, { target: 'svelte' }, ctx);
    const code = out();
    expect(code).toContain('<script lang="ts">');
    expect(code).toContain('$bindable');
    expect(code).toContain('$state');
    expect(code).toContain('$derived');
    // Sanity: the Svelte template block survived.
    expect(code).toMatch(/<button[^>]*on:click=|<button[^>]*onclick=/);
  });
});

describe('runBuild — angular target (Counter.rozie -> Angular standalone .ts)', () => {
  it('emits an Angular 17+ standalone component with signal()/input()/model() and default export', async () => {
    const { ctx, out } = makeBufs();
    await runBuild(COUNTER_PATH, { target: 'angular' }, ctx);
    const code = out();
    expect(code).toContain("from '@angular/core'");
    expect(code).toContain('@Component(');
    expect(code).toContain('standalone: true');
    expect(code).toContain('export class Counter');
    expect(code).toContain('export default Counter');
    // Signals API surface (not the legacy @Input/@Output decorators).
    expect(code).toMatch(/signal\(|model\(|input\(/);
    expect(code).not.toContain('*ngIf');
    expect(code).not.toContain('*ngFor');
  });
});

describe('runBuild — error paths', () => {
  it('exits 2 with "unknown target" stderr for an invalid name', async () => {
    const { ctx, err } = makeBufs();
    await expect(
      runBuild(COUNTER_PATH, { target: 'preact' }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/unknown target 'preact'/);
  });
});

// Phase 6 Plan 03 D-89 layout — `--out` is now always treated as the OUTPUT
// ROOT directory; the per-tuple output path is computed by computeOutputPath
// as `<outDir>/{target}/{source-rel}/Foo.{ext}`. The legacy "if --out is a
// file path, write there directly" behavior is removed; tests below assert
// the new D-89 paths.
describe('runBuild — --out writes byte-identical output (D-89 layout)', () => {
  it('writes the same bytes that stdout would print, at <out>/{target}/{rel}/Foo.{ext}', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-test-'));

    // First: capture stdout output (no --out → stdout fallthrough for non-React).
    const { ctx: stdoutCtx, out } = makeBufs();
    await runBuild(COUNTER_PATH, {}, stdoutCtx);
    const stdoutCode = out();

    // Second: write to disk via --out (now a directory per D-89). The output
    // path includes a per-target subdir AND the source-rel-path from rootDir
    // (process.cwd by default; for COUNTER_PATH = /repo/examples/Counter.rozie
    // and rootDir=/repo, the rel-path is `examples`).
    const { ctx: fileCtx } = makeBufs();
    await runBuild(COUNTER_PATH, { out: tmp }, fileCtx);
    // Search for the emitted file under tmp — exact rel-path depends on cwd.
    // We accept either `<tmp>/vue/Counter.vue` or `<tmp>/vue/<rel>/Counter.vue`.
    const candidates = [
      join(tmp, 'vue', 'Counter.vue'),
      join(tmp, 'vue', 'examples', 'Counter.vue'),
    ];
    const found = candidates.find((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBeDefined();
    const onDisk = readFileSync(found!, 'utf8');
    expect(onDisk).toBe(stdoutCode);
    expect(onDisk).toContain('<script setup lang="ts">');
  });
});

describe('runBuildMany — multi-file batch (D-89 layout)', () => {
  it('compiles multiple inputs into the output directory under {target}/ subdir', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-many-'));
    const { ctx } = makeBufs();
    await runBuildMany([COUNTER_PATH, COUNTER_PATH], { out: tmp, target: 'vue' }, ctx);
    // Both write to the same target/rel/basename (Counter.vue) — second overwrites first, file must exist.
    const candidates = [
      join(tmp, 'vue', 'Counter.vue'),
      join(tmp, 'vue', 'examples', 'Counter.vue'),
    ];
    const found = candidates.find((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBeDefined();
    const written = readFileSync(found!, 'utf8');
    expect(written).toContain('<script setup lang="ts">');
  });

  it('creates the output directory tree if it does not exist (react target)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-mkdir-'));
    const newDir = join(tmp, 'nested', 'out');
    const { ctx } = makeBufs();
    await runBuildMany([COUNTER_PATH], { out: newDir, target: 'react' }, ctx);
    const candidates = [
      join(newDir, 'react', 'Counter.tsx'),
      join(newDir, 'react', 'examples', 'Counter.tsx'),
    ];
    const found = candidates.find((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBeDefined();
    const written = readFileSync(found!, 'utf8');
    expect(written).toContain('export default function Counter');
  });

  it('exits 2 with ROZ852 when --out is omitted for multi-input', async () => {
    // Use two DISTINCT inputs so expandInputs's dedup doesn't collapse them.
    const SEARCH_INPUT_PATH = resolve(__dirname, '../../../../examples/SearchInput.rozie');
    const { ctx, err } = makeBufs();
    await expect(
      runBuildMany([COUNTER_PATH, SEARCH_INPUT_PATH], {}, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/--out.*required|ROZ852/);
  });

  it('continues compiling after one failure and exits 1 at the end', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-partial-'));
    const badPath = join(tmp, 'Bad.rozie');
    writeFileSync(
      badPath,
      [
        '<rozie name="Bad">',
        '<props>{ step: { type: Number, default: 1 } }</props>',
        '<script>$props.step = 2</script>',
        '<template><div></div></template>',
        '</rozie>',
        '',
      ].join('\n'),
      'utf8',
    );

    const outDir = mkdtempSync(join(tmpdir(), 'rozie-cli-partial-out-'));
    const { ctx, err } = makeBufs();
    const thrown = await runBuildMany(
      [COUNTER_PATH, badPath],
      { out: outDir, target: 'vue' },
      ctx,
    ).catch((e) => e);

    expect(thrown).toBeInstanceOf(BuildExit);
    expect((thrown as BuildExit).code).toBe(1);
    // The good file still compiled — search for it under the D-89 layout.
    const candidates = [
      join(outDir, 'vue', 'Counter.vue'),
      join(outDir, 'vue', 'examples', 'Counter.vue'),
    ];
    const found = candidates.find((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBeDefined();
    const counterCode = readFileSync(found!, 'utf8');
    expect(counterCode).toContain('<script setup');
    // Failure summary mentions the count.
    expect(err()).toMatch(/1 of 2/);
  });
});

describe('runBuild — diagnostic rendering', () => {
  it('renders a ROZ200 code-frame to stderr and exits 1 for a write to a non-model prop', async () => {
    // Synthesise a .rozie that writes to a non-model prop. `step` has no
    // `model: true` so `$props.step = 1` is ROZ200 (WRITE_TO_NON_MODEL_PROP).
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-bad-'));
    const badPath = join(tmp, 'Bad.rozie');
    writeFileSync(
      badPath,
      [
        '<rozie name="Bad">',
        '<props>',
        '{ step: { type: Number, default: 1 } }',
        '</props>',
        '<script>',
        '$props.step = 2',
        '</script>',
        '<template><div></div></template>',
        '</rozie>',
        '',
      ].join('\n'),
      'utf8',
    );

    const { ctx, err } = makeBufs();
    let thrown: BuildExit | null = null;
    try {
      await runBuild(badPath, {}, ctx);
    } catch (e) {
      thrown = e as BuildExit;
    }
    expect(thrown).toBeInstanceOf(BuildExit);
    expect(thrown?.code).toBe(1);
    expect(err()).toMatch(/ROZ200/);
    // The code-frame renders the offending line with a caret marker.
    expect(err()).toMatch(/\$props\.step/);
  });
});

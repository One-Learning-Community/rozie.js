// Happy-path + error-path tests for the `rozie build` subcommand.
//
// Strategy: drive runBuild() directly with `exit: 'throw'` so we don't have
// to spawn a child node. stdout/stderr are captured into string buffers via
// the ctx sinks. Tests cover the four outcomes the spike has to deliver:
//
//  1. Counter.rozie compiles to a valid Vue 3 SFC (defineProps + defineModel
//     + computed + script setup).
//  2. --target react exits with code 2 and the "not yet shipped" message.
//  3. --out writes a file whose contents are byte-identical to the stdout
//     emission for the same input.
//  4. A .rozie file with `$props.notDeclared = 1` triggers ROZ200, renders a
//     code-frame to stderr, and exits 1.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BuildExit, runBuild } from '../commands/build.js';

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

describe('runBuild — target gating', () => {
  it('exits 2 with "not yet shipped" stderr for --target react', async () => {
    const { ctx, err } = makeBufs();
    await expect(runBuild(COUNTER_PATH, { target: 'react' }, ctx)).rejects.toBeInstanceOf(
      BuildExit,
    );
    expect(err()).toMatch(/not yet shipped/);
    expect(err()).toMatch(/Phase 4/);
    // The thrown BuildExit carries the exit code.
    try {
      await runBuild(COUNTER_PATH, { target: 'svelte' }, makeBufs().ctx);
    } catch (e) {
      expect((e as BuildExit).code).toBe(2);
    }
  });

  it('exits 2 with "unknown target" stderr for an invalid name', async () => {
    const { ctx, err } = makeBufs();
    await expect(
      runBuild(COUNTER_PATH, { target: 'preact' }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/unknown target 'preact'/);
  });
});

describe('runBuild — --out writes byte-identical output', () => {
  it('writes the same bytes that --no-out would print to stdout', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-test-'));
    const outFile = join(tmp, 'Counter.vue');

    // First: capture stdout output.
    const { ctx: stdoutCtx, out } = makeBufs();
    await runBuild(COUNTER_PATH, {}, stdoutCtx);
    const stdoutCode = out();

    // Second: write to disk via --out.
    const { ctx: fileCtx } = makeBufs();
    await runBuild(COUNTER_PATH, { out: outFile }, fileCtx);
    const onDisk = readFileSync(outFile, 'utf8');

    expect(onDisk).toBe(stdoutCode);
    expect(onDisk).toContain('<script setup lang="ts">');
  });
});

describe('runBuild — --out directory auto-naming', () => {
  it('appends <basename>.<target-ext> when --out is an existing directory', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-dir-'));
    const { ctx } = makeBufs();
    await runBuild(COUNTER_PATH, { out: tmp }, ctx);
    const written = readFileSync(join(tmp, 'Counter.vue'), 'utf8');
    expect(written).toContain('<script setup lang="ts">');
  });

  it('treats a non-existent --out path as a file (does not require parent dir to exist as itself)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-newfile-'));
    const newFile = join(tmp, 'Custom.vue');
    const { ctx } = makeBufs();
    await runBuild(COUNTER_PATH, { out: newFile }, ctx);
    const written = readFileSync(newFile, 'utf8');
    expect(written).toContain('<script setup lang="ts">');
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

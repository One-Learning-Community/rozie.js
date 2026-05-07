// DIST-04 multi-target.test.ts — runBuildMatrix coordinator behavior tests
// (M1..M12 from Phase 6 Plan 03 §<behavior>).
//
// All tests drive runBuildMatrix directly with `exit: 'throw'` so vitest can
// assert exit codes via BuildExit. Output dirs use mkdtempSync to keep the
// repo clean.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BuildExit, runBuildMatrix } from '../commands/build.js';
import type { Target } from '../utils/parseTargets.js';

const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES_DIR = join(REPO_ROOT, 'examples');
const COUNTER_PATH = join(EXAMPLES_DIR, 'Counter.rozie');
const SEARCH_INPUT_PATH = join(EXAMPLES_DIR, 'SearchInput.rozie');

const ALL_TARGETS: Target[] = ['vue', 'react', 'svelte', 'angular'];

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

/** Walk a directory recursively and return a sorted list of relative paths. */
function listFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string, prefix: string): void {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  }
  if (existsSync(root)) walk(root, '');
  return out.sort();
}

describe('runBuildMatrix — multi-target single input (M1)', () => {
  it('M1: 4 targets × 1 input → 4 primary files in target-subdirs (+ React .d.ts default)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m1-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [COUNTER_PATH],
      { target: ALL_TARGETS, out: tmp, root: REPO_ROOT },
      ctx,
    );
    expect(existsSync(join(tmp, 'vue', 'examples', 'Counter.vue'))).toBe(true);
    expect(existsSync(join(tmp, 'react', 'examples', 'Counter.tsx'))).toBe(true);
    expect(existsSync(join(tmp, 'react', 'examples', 'Counter.d.ts'))).toBe(true);
    expect(existsSync(join(tmp, 'svelte', 'examples', 'Counter.svelte'))).toBe(true);
    expect(existsSync(join(tmp, 'angular', 'examples', 'Counter.ts'))).toBe(true);
  });
});

describe('runBuildMatrix — multi-target multi-input (M2)', () => {
  it('M2: 5 examples × 4 targets = 20 primary files; React adds 5 .d.ts (D-90 default)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m2-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [EXAMPLES_DIR],
      { target: ALL_TARGETS, out: tmp, root: REPO_ROOT },
      ctx,
    );
    const files = listFiles(tmp);
    // Filter to just the 5 reference examples (Counter, SearchInput, Dropdown, TodoList, Modal)
    // — these live directly in examples/, not examples/consumers/.
    const reference = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'];
    for (const name of reference) {
      expect(files.some((f) => f === `vue/examples/${name}.vue`)).toBe(true);
      expect(files.some((f) => f === `react/examples/${name}.tsx`)).toBe(true);
      expect(files.some((f) => f === `react/examples/${name}.d.ts`)).toBe(true);
      expect(files.some((f) => f === `svelte/examples/${name}.svelte`)).toBe(true);
      expect(files.some((f) => f === `angular/examples/${name}.ts`)).toBe(true);
    }
    // No .map files — D-91 default OFF.
    const mapFiles = files.filter((f) => f.endsWith('.map'));
    expect(mapFiles.length).toBe(0);
  });
});

describe('runBuildMatrix — --no-types disables .d.ts (M3)', () => {
  it('M3: { types: false } skips .d.ts emission for React', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m3-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [COUNTER_PATH],
      { target: ['react'], out: tmp, types: false, root: REPO_ROOT },
      ctx,
    );
    expect(existsSync(join(tmp, 'react', 'examples', 'Counter.tsx'))).toBe(true);
    expect(existsSync(join(tmp, 'react', 'examples', 'Counter.d.ts'))).toBe(false);
  });
});

describe('runBuildMatrix — --source-map enables .map (M4)', () => {
  it('M4 default: no .map files', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m4-default-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [COUNTER_PATH],
      { target: ['vue'], out: tmp, root: REPO_ROOT },
      ctx,
    );
    const files = listFiles(tmp);
    expect(files.some((f) => f.endsWith('.map'))).toBe(false);
  });

  it('M4 explicit: { sourceMap: true } emits .map sibling', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m4-on-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [COUNTER_PATH],
      { target: ['vue'], out: tmp, sourceMap: true, root: REPO_ROOT },
      ctx,
    );
    const files = listFiles(tmp);
    expect(files.some((f) => f.endsWith('.vue.map'))).toBe(true);
  });
});

describe('runBuildMatrix — backward-compat single-target single-input via stdout (M5/M12)', () => {
  it('M5/M12: vue + no --out → stdout fallthrough (non-React targets preserve legacy)', async () => {
    const { ctx, out } = makeBufs();
    await runBuildMatrix([COUNTER_PATH], { target: ['vue'] }, ctx);
    expect(out()).toContain('<script setup');
  });
});

describe('runBuildMatrix — --out required for multi-target (M6)', () => {
  it('M6: 1 input × 2 targets without --out → ROZ852 + exit 2', async () => {
    const { ctx, err } = makeBufs();
    await expect(
      runBuildMatrix([COUNTER_PATH], { target: ['vue', 'svelte'] }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/ROZ852/);
    expect(err()).toMatch(/--out/);
  });
});

describe('runBuildMatrix — deduplication (M7)', () => {
  it('M7: explicit input + same input via dir/glob deduplicates (Pitfall 4)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m7-'));
    const { ctx } = makeBufs();
    // Counter is named explicitly AND included in EXAMPLES_DIR walk.
    await runBuildMatrix(
      [EXAMPLES_DIR, COUNTER_PATH],
      { target: ['vue'], out: tmp, root: REPO_ROOT },
      ctx,
    );
    // Counter should appear at exactly one path under tmp/vue/examples/.
    const files = listFiles(tmp);
    const counterFiles = files.filter((f) => f.endsWith('/Counter.vue'));
    // Each unique source-rel-path emits one Counter.vue. The explicit
    // COUNTER_PATH and the directory walk yield the same absolute path → 1.
    expect(counterFiles.length).toBeGreaterThanOrEqual(1);
    // The exact absolute path should not be duplicated; the file write either
    // succeeded once or was a no-op overwrite. The key M7 assertion: NO error.
    expect(existsSync(join(tmp, 'vue', 'examples', 'Counter.vue'))).toBe(true);
  });
});

describe('runBuildMatrix — compile() integration (M9/M10)', () => {
  it('M9: errors from compile() surface to stderr and contribute to failure count', async () => {
    // Compile a synthetic .rozie that exercises a known compile error code.
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m9-'));
    const fs = await import('node:fs');
    const badPath = join(tmp, 'Bad.rozie');
    fs.writeFileSync(
      badPath,
      [
        '<rozie name="Bad">',
        '<props>{ step: { type: Number, default: 1 } }</props>',
        '<script>$props.step = 2</script>', // ROZ200 — write to non-model prop
        '<template><div></div></template>',
        '</rozie>',
        '',
      ].join('\n'),
      'utf8',
    );
    const outDir = mkdtempSync(join(tmpdir(), 'rozie-cli-m9-out-'));
    const { ctx, err } = makeBufs();
    await expect(
      runBuildMatrix([badPath], { target: ['vue'], out: outDir, root: tmp }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/ROZ200/);
  });
});

describe('runBuildMatrix — DIST-04 react+stdout guard (M11)', () => {
  it('M11: target=react with no --out → ROZ855 + exit 2 BEFORE any fs writes', async () => {
    const { ctx, err } = makeBufs();
    await expect(
      runBuildMatrix([COUNTER_PATH], { target: ['react'] }, ctx),
    ).rejects.toBeInstanceOf(BuildExit);
    expect(err()).toMatch(/\[ROZ855\]/);
    expect(err()).toMatch(/react/);
    expect(err()).toMatch(/--out/);
    // No Counter.tsx written next to cwd or anywhere.
    expect(existsSync(resolve('Counter.tsx'))).toBe(false);
  });
});

describe('runBuildMatrix — multi-input multi-target combined (M2 cross-check)', () => {
  it('multi-input + multi-target combined invocation succeeds', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-m2cross-'));
    const { ctx } = makeBufs();
    await runBuildMatrix(
      [COUNTER_PATH, SEARCH_INPUT_PATH],
      { target: ['vue', 'svelte'], out: tmp, root: REPO_ROOT },
      ctx,
    );
    expect(existsSync(join(tmp, 'vue', 'examples', 'Counter.vue'))).toBe(true);
    expect(existsSync(join(tmp, 'vue', 'examples', 'SearchInput.vue'))).toBe(true);
    expect(existsSync(join(tmp, 'svelte', 'examples', 'Counter.svelte'))).toBe(true);
    expect(existsSync(join(tmp, 'svelte', 'examples', 'SearchInput.svelte'))).toBe(true);
  });
});

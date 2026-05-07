// Tests for D-87 (parseTargets comma-split) + D-88 (expandInputs file/dir/glob).
//
// E1..E8 cover expandInputs's auto-detect + security posture.
// C1..C4 cover commander's --target/--no-types/--source-map parsing via the
// parseTargets utility. We test parseTargets directly rather than driving
// commander.parseAsync because the latter would require argv-faking + commander
// state-leaking workarounds that aren't worth the indirection for a parser
// unit-test.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Command, InvalidArgumentError } from 'commander';
import { expandInputs } from '../utils/expandInputs.js';
import { parseTargets, VALID_TARGETS, type Target } from '../utils/parseTargets.js';

const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES_DIR = join(REPO_ROOT, 'examples');
const COUNTER_PATH = join(EXAMPLES_DIR, 'Counter.rozie');

describe('expandInputs — file/dir/glob auto-detect (D-88)', () => {
  it('E1: file input resolves to absolute path', async () => {
    const result = await expandInputs([COUNTER_PATH]);
    expect(result).toEqual([COUNTER_PATH]);
  });

  it('E2: directory input expands to all .rozie files within', async () => {
    const result = await expandInputs([EXAMPLES_DIR]);
    // 5 reference examples: Counter, SearchInput, Dropdown, TodoList, Modal
    expect(result.length).toBeGreaterThanOrEqual(5);
    for (const p of result) {
      expect(p.endsWith('.rozie')).toBe(true);
    }
    expect(result.some((p) => p.endsWith('/Counter.rozie'))).toBe(true);
    expect(result.some((p) => p.endsWith('/Modal.rozie'))).toBe(true);
  });

  it('E3: glob magic chars trigger fast-glob.isDynamicPattern path', async () => {
    const pattern = join(EXAMPLES_DIR, '*.rozie');
    const result = await expandInputs([pattern]);
    expect(result.length).toBeGreaterThanOrEqual(5);
    for (const p of result) expect(p.endsWith('.rozie')).toBe(true);
  });

  it('E4: mixed inputs deduplicate and sort by absolute path', async () => {
    // Counter.rozie is named explicitly AND included via the directory walk.
    // Note: examples/ itself contains a top-level Counter.rozie; examples/consumers/
    // also contains 3 sibling Counter.rozie files in different subdirs. These
    // are DISTINCT absolute paths so they aren't deduped — but the explicit
    // COUNTER_PATH must NOT cause its absolute path to appear twice.
    const result = await expandInputs([COUNTER_PATH, EXAMPLES_DIR]);
    // No exact-path duplicates (Pitfall 4 mitigation — Set semantics).
    const seen = new Set<string>();
    for (const p of result) {
      expect(seen.has(p)).toBe(false);
      seen.add(p);
    }
    // The explicit COUNTER_PATH appears in the result exactly once.
    expect(result.filter((p) => p === COUNTER_PATH).length).toBe(1);
    // Sorted in lexicographic order.
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('E5: missing file throws cannot-stat error', async () => {
    await expect(expandInputs(['/nonexistent/path/Foo.rozie'])).rejects.toThrow(/cannot stat input/);
  });

  it('E6: non-.rozie file rejected with clear error', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-expand-test-'));
    const notRozie = join(tmp, 'package.json');
    writeFileSync(notRozie, '{}');
    await expect(expandInputs([notRozie])).rejects.toThrow(/is not a \.rozie file/);
  });

  it('E7: top-level symlink arg refused (defense-in-depth)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-expand-symlink-'));
    const real = join(tmp, 'real.rozie');
    const link = join(tmp, 'link.rozie');
    writeFileSync(real, '<rozie></rozie>');
    try {
      symlinkSync(real, link);
    } catch {
      // Some CI environments forbid creating symlinks; skip the assertion in
      // that case (the security posture is still tested locally + when CI does
      // permit symlinks).
      return;
    }
    await expect(expandInputs([link])).rejects.toThrow(/refusing symlink input/);
  });

  it('E8: null-byte injection in input arg rejected', async () => {
    await expect(expandInputs(['Foo.rozie\0evil.txt'])).rejects.toThrow(/null byte/);
  });
});

describe('parseTargets — D-87 commander comma-split parser', () => {
  it('C1: single token resolves to a one-element array', () => {
    expect(parseTargets('react')).toEqual(['react']);
  });

  it('C1b: comma-separated multi-token parses to ordered array', () => {
    expect(parseTargets('react,vue')).toEqual(['react', 'vue']);
  });

  it('C1c: whitespace around tokens is trimmed', () => {
    expect(parseTargets(' react , vue , svelte ')).toEqual(['react', 'vue', 'svelte']);
  });

  it('C2: invalid token throws InvalidArgumentError with [ROZ850] prefix', () => {
    expect(() => parseTargets('react,bogus')).toThrow(InvalidArgumentError);
    expect(() => parseTargets('react,bogus')).toThrow(/\[ROZ850\] unknown target 'bogus'/);
  });

  it('C2b: VALID_TARGETS exposes all five documented targets (Phase 06.3-01 added solid)', () => {
    const expected: Target[] = ['vue', 'react', 'svelte', 'angular', 'solid'];
    for (const t of expected) expect(VALID_TARGETS.has(t)).toBe(true);
    expect(VALID_TARGETS.size).toBe(5);
  });

  it('C3: --no-types commander semantics — opts.types === false when present', async () => {
    // Drive a minimal program directly; commander's `.option('--no-types')`
    // produces `opts.types === false` when `--no-types` is on argv and
    // `opts.types === true` when omitted.
    const program = new Command();
    let captured: { types?: boolean } | null = null;
    program
      .command('build [inputs...]')
      .option('--no-types', 'skip .d.ts emission')
      .action((_inputs, opts) => {
        captured = opts;
      });
    await program.parseAsync(['node', 'rozie', 'build', 'foo', '--no-types']);
    expect(captured).not.toBeNull();
    expect(captured!.types).toBe(false);
  });

  it('C3b: default --types is true (Commander auto-default for --no-* flags)', async () => {
    const program = new Command();
    let captured: { types?: boolean } | null = null;
    program
      .command('build [inputs...]')
      .option('--no-types', 'skip .d.ts emission')
      .action((_inputs, opts) => {
        captured = opts;
      });
    await program.parseAsync(['node', 'rozie', 'build', 'foo']);
    expect(captured).not.toBeNull();
    expect(captured!.types).toBe(true);
  });

  it('C4: --source-map default is undefined; explicit flag → true', async () => {
    const program = new Command();
    let captured: { sourceMap?: boolean } | null = null;
    program
      .command('build [inputs...]')
      .option('--source-map', 'emit .map files')
      .action((_inputs, opts) => {
        captured = opts;
      });
    // Default — undefined when omitted.
    await program.parseAsync(['node', 'rozie', 'build', 'foo']);
    expect(captured).not.toBeNull();
    expect(captured!.sourceMap).toBeUndefined();

    // Explicit → true.
    captured = null;
    const program2 = new Command();
    program2
      .command('build [inputs...]')
      .option('--source-map', 'emit .map files')
      .action((_inputs, opts) => {
        captured = opts;
      });
    await program2.parseAsync(['node', 'rozie', 'build', 'foo', '--source-map']);
    expect(captured).not.toBeNull();
    expect(captured!.sourceMap).toBe(true);
  });
});

describe('outputPath utilities — D-89 layout (smoke)', () => {
  // Full L1-L3 coverage lives in output-layout.test.ts (Task 2). These two
  // smoke checks confirm the utility module is importable and exports the
  // shared TARGET_EXTENSIONS table the rest of the CLI depends on.
  it('outputPath module exports the TARGET_EXTENSIONS table', async () => {
    const { TARGET_EXTENSIONS } = await import('../utils/outputPath.js');
    expect(TARGET_EXTENSIONS.vue).toBe('.vue');
    expect(TARGET_EXTENSIONS.react).toBe('.tsx');
    expect(TARGET_EXTENSIONS.svelte).toBe('.svelte');
    expect(TARGET_EXTENSIONS.angular).toBe('.ts');
  });

  it('outputPath module exports computeOutputPath', async () => {
    const { computeOutputPath } = await import('../utils/outputPath.js');
    expect(typeof computeOutputPath).toBe('function');
  });
});

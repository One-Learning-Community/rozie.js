/**
 * CLI e2e smoke — workspace-root binary wiring + user-facing invocation.
 *
 * Catches the regression class that motivated commit 33bb7f1: `pnpm exec
 * rozie` returning "Command 'rozie' not found" because @rozie/cli wasn't
 * listed as a workspace-root devDependency, so node_modules/.bin/rozie was
 * never linked. A vitest inside packages/cli would have invoked runCli()
 * directly and missed the wiring layer — this smoke exercises the bin
 * symlink + shebang chain end-to-end.
 *
 * Coverage:
 *   1. Workspace-root bin link exists and resolves to a real file
 *   2. Direct bin invocation: --help / --version / build (stdout + dir)
 *   3. `pnpm exec rozie` from workspace cwd (true user-facing surface)
 *   4. Error paths: missing file / bad target / multi-out missing
 *
 * Lives at workspace root (not inside packages/cli) so it exercises the
 * actual link-into-.bin/ path. CPU-light (each spawn < 1s on a warm cache);
 * runs under the default `turbo run test` task with no test:smoke carve-out.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Smoke is Unix-only. pnpm produces a different bin-shim shape on Windows
// (`.cmd` files at a slightly different path), and every CI matrix +
// developer environment in this repo is Linux/Mac. If anyone ever runs
// this on Windows, skip rather than fail with a confusing path mismatch.
const skipOnWindows = process.platform === 'win32' ? it.skip : it;

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(HERE, '../..');
const ROOT_BIN = join(WORKSPACE_ROOT, 'node_modules', '.bin', 'rozie');
const FIXTURE = join(HERE, 'fixtures', 'Counter.rozie');

// Spawn the rozie bin directly so the OS shebang chain runs — this is the
// same code path a user would hit via `pnpm exec rozie` or a bare `rozie`
// on PATH. Bypassing the shim (`node <binPath>`) would mask wiring bugs.
function rozie(args: string[], opts: { cwd?: string } = {}) {
  return spawnSync(ROOT_BIN, args, {
    cwd: opts.cwd ?? WORKSPACE_ROOT,
    encoding: 'utf8',
    // Inherit env so PATH / NODE_OPTIONS reflect the real invocation context.
    env: process.env,
  });
}

describe('CLI bin wiring (workspace root)', () => {
  // The single most important assertion in this file — if this fails, the
  // 33bb7f1 fix has regressed and `pnpm exec rozie` is broken for every
  // downstream caller (docs examples, dist-parity, consumer demos).
  skipOnWindows('node_modules/.bin/rozie exists at workspace root', () => {
    expect(existsSync(ROOT_BIN)).toBe(true);
    const stat = lstatSync(ROOT_BIN);
    // pnpm hard-links or symlinks; either is fine — we just need a real entry.
    expect(stat.isFile() || stat.isSymbolicLink()).toBe(true);
  });

  skipOnWindows('bin resolves through to the @rozie/cli dist artefact', () => {
    // statSync follows symlinks. pnpm's bin link at workspace root is a
    // POSIX shell shim (`#!/bin/sh`, the cross-platform pattern), which
    // then `exec`s the underlying `dist/bin.cjs`. We assert two things:
    //  1. The shim itself is non-empty (catches a broken link).
    //  2. The downstream dist/bin.cjs exists and has the node shebang
    //     (catches the case where @rozie/cli built badly or got purged).
    const shim = statSync(ROOT_BIN);
    expect(shim.isFile()).toBe(true);
    expect(shim.size).toBeGreaterThan(0);

    const distBin = resolve(WORKSPACE_ROOT, 'packages/cli/dist/bin.cjs');
    expect(existsSync(distBin)).toBe(true);
    const head = readFileSync(distBin, 'utf8').slice(0, 32);
    expect(head.startsWith('#!/usr/bin/env node')).toBe(true);
  });
});

describe('CLI invocation (direct bin spawn)', () => {
  skipOnWindows('--help exits 0 and prints usage', () => {
    const r = rozie(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage: rozie/);
    expect(r.stdout).toMatch(/build/);
  });

  skipOnWindows('--version exits 0 and prints a version string', () => {
    const r = rozie(['--version']);
    expect(r.status).toBe(0);
    // Whatever the version is, it should at least look like one.
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  skipOnWindows('build Counter.rozie --target vue streams compiled SFC to stdout', () => {
    const r = rozie(['build', FIXTURE, '--target', 'vue']);
    expect(r.status).toBe(0);
    // Loose markers — exact emit byte-shape is covered by dist-parity. We
    // just need to know real compile output came out the right pipe.
    expect(r.stdout).toMatch(/<template>/);
    expect(r.stdout).toMatch(/<script/);
  });

  skipOnWindows('build Counter.rozie --target vue,react,svelte --out <tmp> produces per-target files', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rozie-cli-smoke-'));
    try {
      // Run with cwd=tmp so the absolute fixture (which lives in the rozie
      // workspace, outside tmp) triggers outputPath.ts:61-63's defensive
      // flatten — the rel-path starts with `..`, so source-rel collapses
      // to '' and emit lands at <out>/<target>/<basename>.<ext>. Asserting
      // the flat layout keeps the test stable regardless of where this
      // workspace lives on disk; the rel-preserve layout is covered by
      // the cli unit tests inside packages/cli/src/__tests__/.
      const r = rozie(['build', FIXTURE, '--target', 'vue,react,svelte', '--out', tmp], {
        cwd: tmp,
      });
      expect(r.status).toBe(0);
      expect(existsSync(join(tmp, 'vue', 'Counter.vue'))).toBe(true);
      expect(existsSync(join(tmp, 'react', 'Counter.tsx'))).toBe(true);
      expect(existsSync(join(tmp, 'svelte', 'Counter.svelte'))).toBe(true);
      // React emits .d.ts sidecar by default (D-90).
      expect(existsSync(join(tmp, 'react', 'Counter.d.ts'))).toBe(true);
      // Each emitted file is non-empty.
      for (const p of [
        join(tmp, 'vue', 'Counter.vue'),
        join(tmp, 'react', 'Counter.tsx'),
        join(tmp, 'svelte', 'Counter.svelte'),
      ]) {
        expect(statSync(p).size).toBeGreaterThan(0);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('CLI invocation (pnpm exec — true user-facing wire)', () => {
  // This test confirms the SHIM resolution `pnpm exec` does (walk up looking
  // for node_modules/.bin/<cmd>) finds rozie from the workspace root. It's
  // the closest stand-in for the user typing `pnpm exec rozie --help` in
  // their own clone of the repo. Slower than the direct-bin tests because
  // pnpm spins up its own resolver; we run it just once.
  skipOnWindows('pnpm exec rozie --help resolves and exits 0 from workspace root', () => {
    const r = spawnSync('pnpm', ['exec', 'rozie', '--help'], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      env: process.env,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage: rozie/);
  });
});

describe('CLI error paths (diagnostic surfacing)', () => {
  skipOnWindows('build with missing input file exits non-zero with ROZ851', () => {
    const r = rozie(['build', '/nonexistent/path/DoesNotExist.rozie']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/ROZ851/);
  });

  skipOnWindows('build with unknown --target exits non-zero with ROZ850', () => {
    const r = rozie(['build', FIXTURE, '--target', 'jquery']);
    expect(r.status).not.toBe(0);
    // commander's InvalidArgumentError surface prefixes "error:" + the
    // ROZ850 message from parseTargets.ts.
    expect(r.stderr).toMatch(/ROZ850/);
  });

  skipOnWindows('build with multiple targets requires --out (ROZ852)', () => {
    const r = rozie(['build', FIXTURE, '--target', 'vue,react']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/ROZ852/);
  });
});

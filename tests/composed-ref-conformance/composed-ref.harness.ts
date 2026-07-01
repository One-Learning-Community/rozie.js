/**
 * COMPOSED-REF WITNESS HARNESS — Phase 66 (composed-component ref → Handle
 * typing), D-4.
 *
 * Compiles the ComposedRefParent + ExposeChild fixtures to each of the 6 targets
 * and typechecks the emitted output with that target's REAL checker:
 *   - react / solid / lit / angular → plain `tsc --noEmit` (the composed-ref call
 *     lands in a `.tsx` / `.ts` body plain tsc can check)
 *   - vue    → `vue-tsc --noEmit`  (SFC)
 *   - svelte → `svelte-check`      (SFC)
 *
 * Each target reuses an existing sibling test-package's node_modules (for type
 * RESOLUTION of react/solid-js/lit/@angular/vue/svelte + @rozie/runtime-*) and
 * its pinned checker binary + tsconfig — mirrors the tests/{react,vue,svelte,
 * angular}-typecheck + tests/{solid,lit}-lint harness mechanism.
 *
 * The witness OBSERVES (never assumes) the pre-fix typing: a `<components>`-
 * composed child referenced via `$refs.child` types as `HTMLElement` on
 * react/vue/svelte/solid/lit, so `$refs.child.ping()` is a TS2339 ("property
 * 'ping' does not exist on type 'HTMLElement'"). Angular alone types the ref as
 * the child instance → clean.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, type CompileTarget } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export type Target = 'react' | 'vue' | 'svelte' | 'solid' | 'lit' | 'angular';

interface TargetConfig {
  /** File extension for the emitted fixture files. */
  ext: string;
  /** Sibling test package (from ROOT) supplying node_modules + tsconfig + checker. */
  sibling: string;
  /** Checker binary name in the sibling's node_modules/.bin. */
  bin: string;
  /** Checker argv (relative to the tmpdir cwd). */
  args: string[];
  /** Extra ambient .d.ts files copied from the sibling (engine stubs, css-modules). */
  extraDts?: string[];
  /** When set, write this ambient .d.ts into the tmpdir (declares '*.rozie' for Lit). */
  ambientRozie?: boolean;
}

const CONFIG: Record<Target, TargetConfig> = {
  react: {
    ext: 'tsx',
    sibling: 'tests/react-typecheck',
    bin: 'tsc',
    args: ['--noEmit', '-p', 'tsconfig.json'],
    extraDts: ['css-modules.d.ts', 'engine-modules.d.ts'],
  },
  solid: {
    ext: 'tsx',
    sibling: 'tests/solid-lint',
    bin: 'tsc',
    args: ['--noEmit', '-p', 'tsconfig.json'],
    extraDts: ['engine-modules.d.ts'],
  },
  lit: {
    ext: 'ts',
    sibling: 'tests/lit-lint',
    bin: 'tsc',
    args: ['--noEmit', '-p', 'tsconfig.json'],
    extraDts: ['engine-modules.d.ts'],
    ambientRozie: true,
  },
  angular: {
    ext: 'ts',
    sibling: 'tests/angular-typecheck',
    bin: 'tsc',
    args: ['--noEmit', '-p', 'tsconfig.json'],
    extraDts: ['engine-modules.d.ts'],
  },
  vue: {
    ext: 'vue',
    sibling: 'tests/vue-typecheck',
    bin: 'vue-tsc',
    args: ['--noEmit', '-p', 'tsconfig.json'],
    extraDts: ['engine-modules.d.ts'],
  },
  svelte: {
    ext: 'svelte',
    sibling: 'tests/svelte-typecheck',
    bin: 'svelte-check',
    args: ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
    extraDts: ['engine-modules.d.ts'],
  },
};

/** Compile a fixture source to a target; throw on a compiler-error diagnostic. */
function compileFixture(source: string, target: Target, filename: string): string {
  const result = compile(source, {
    target: target as CompileTarget,
    filename,
    sourceMap: false,
  });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `[${target}] compile(${filename}) reported errors: ${errors
        .map((d) => d.message)
        .join('; ')}`,
    );
  }
  return result.code;
}

export interface WitnessResult {
  /** Raw combined stdout+stderr from the target's checker. */
  raw: string;
  /** Count of TS2339 "property 'ping' does not exist on type 'HTMLElement'" hits. */
  pingHtmlElementCount: number;
  /** Any TS2339 count (broader). */
  ts2339Count: number;
}

const FIXTURE_DIR = join(HERE, 'fixtures');

/**
 * Compile both fixtures to `target`, typecheck the emitted pair, and return the
 * raw checker output plus the composed-ref TS2339 counts.
 */
export function runWitness(target: Target): WitnessResult {
  const cfg = CONFIG[target];
  const siblingDir = resolve(ROOT, cfg.sibling);
  const siblingNodeModules = join(siblingDir, 'node_modules');
  const tsconfigSrc = join(siblingDir, 'tsconfig.json');
  const binPath = join(siblingNodeModules, '.bin', cfg.bin);

  if (!existsSync(siblingNodeModules)) {
    throw new Error(
      `[${target}] missing sibling node_modules: ${siblingNodeModules} — run pnpm install / build the workspace first.`,
    );
  }
  if (!existsSync(binPath)) {
    throw new Error(`[${target}] checker not found: ${binPath} — install ${cfg.sibling}.`);
  }
  if (!existsSync(tsconfigSrc)) {
    throw new Error(`[${target}] missing sibling tsconfig: ${tsconfigSrc}`);
  }

  const childSrc = readFileSync(join(FIXTURE_DIR, 'ExposeChild.rozie'), 'utf8');
  const parentSrc = readFileSync(join(FIXTURE_DIR, 'ComposedRefParent.rozie'), 'utf8');

  const childCode = compileFixture(childSrc, target, 'ExposeChild.rozie');
  const parentCode = compileFixture(parentSrc, target, 'ComposedRefParent.rozie');

  const tmpDir = mkdtempSync(join(tmpdir(), `rozie-composed-ref-${target}-`));
  try {
    writeFileSync(join(tmpDir, `ExposeChild.${cfg.ext}`), childCode);
    writeFileSync(join(tmpDir, `ComposedRefParent.${cfg.ext}`), parentCode);
    copyFileSync(tsconfigSrc, join(tmpDir, 'tsconfig.json'));
    for (const dts of cfg.extraDts ?? []) {
      const from = join(siblingDir, dts);
      if (existsSync(from)) copyFileSync(from, join(tmpDir, dts));
    }
    if (cfg.ambientRozie) {
      // Lit's composed-child import is a side-effect `import './ExposeChild.rozie'`
      // (custom-element registration). Declare the module so TS2307 doesn't mask
      // the TS2339 the witness is looking for.
      writeFileSync(join(tmpDir, 'rozie-modules.d.ts'), "declare module '*.rozie';\n");
    }
    symlinkSync(siblingNodeModules, join(tmpDir, 'node_modules'), 'dir');

    let raw = '';
    try {
      execFileSync(binPath, cfg.args, { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      raw = stdout + '\n' + stderr;
    }

    const pingHtmlElementCount = (
      raw.match(
        /Property 'ping' does not exist on type 'HTMLElement'/g,
      ) ?? []
    ).length;
    const ts2339Count = (raw.match(/TS2339/g) ?? []).length;
    return { raw, pingHtmlElementCount, ts2339Count };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

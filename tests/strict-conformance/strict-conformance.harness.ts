/**
 * STRICT-CONFORMANCE HARNESS — per-leaf strict `tsc --noEmit` runner.
 *
 * Phase 65 (Bundle C / Item 2). Mirrors the tests/vue-typecheck/family-children
 * mechanism (tmpdir copy of the committed leaf `src/`, symlinked LEAF
 * node_modules so its real peer deps resolve, pinned `tsc --noEmit`, parseErrors
 * keyed `file → { TScode → count }`) — but drives PLAIN tsc over the React/Solid
 * (`.tsx`) and Lit (`.ts`) emitted leaf bodies under the THREE strict flags the
 * leaf tsconfigs currently RELAX (`strictNullChecks`, `noImplicitAny`,
 * `exactOptionalPropertyTypes`).
 *
 * Why per-leaf (not example-compile like tests/react-typecheck): the strict-null
 * residual lives in the COMMITTED @rozie-ui leaf bodies a strict consumer
 * actually imports — those leaves' own tsconfigs hide it behind the relaxed
 * flags (65-SPIKE-INVENTORY.md). Typechecking the committed src under strict
 * flags is the trust gate this phase restores.
 *
 * Tcc binary: resolved from THIS package's own pinned `typescript`
 * (`node_modules/.bin/tsc`). Type RESOLUTION (react/@types/react, solid-js, lit,
 * @rozie/runtime-*, @tanstack/*) comes from the symlinked leaf node_modules in
 * the tmpdir — tsc resolves modules relative to the compiled files.
 */
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  cpSync,
  copyFileSync,
  writeFileSync,
  symlinkSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export type Target = 'react' | 'solid' | 'lit';

/** `file → { TScode → count }`. */
export type Inventory = Record<string, Record<string, number>>;

export interface LeafSpec {
  /** Human label (e.g. "combobox"). */
  name: string;
  /** Compile target — drives the per-target strict tsconfig. */
  target: Target;
  /** Path (from repo ROOT) to the compiled leaf package (the dir holding src/ + node_modules). */
  leaf: string;
}

export interface LeafResult {
  /** Raw combined stdout+stderr from tsc. */
  raw: string;
  /** Parsed `file → { TScode → count }` inventory. */
  inventory: Inventory;
}

/**
 * Per-target strict compilerOptions. Forces the three relaxed flags
 * (`strictNullChecks`/`noImplicitAny`/`exactOptionalPropertyTypes`) ON over each
 * leaf's own target settings (jsx mode, decorators). Does NOT `extends` the
 * leaf tsconfig (its relative `../../../../../tsconfig.base.json` path would not
 * resolve from the tmpdir) — the relevant base options are inlined.
 */
function strictCompilerOptions(target: Target): Record<string, unknown> {
  const base: Record<string, unknown> = {
    noEmit: true,
    module: 'ESNext',
    target: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    strictNullChecks: true,
    noImplicitAny: true,
    exactOptionalPropertyTypes: true,
    skipLibCheck: true,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
  };
  if (target === 'react') {
    return { ...base, jsx: 'react-jsx', types: ['react'] };
  }
  if (target === 'solid') {
    return { ...base, jsx: 'preserve', jsxImportSource: 'solid-js' };
  }
  // lit
  return {
    ...base,
    experimentalDecorators: true,
    useDefineForClassFields: false,
    noImplicitOverride: false,
  };
}

/** Parse tsc output into `file → { TScode → count }` (basename-keyed). */
export function parseErrors(output: string): Inventory {
  const map: Inventory = {};
  // Matches e.g. `.../src/Combobox.tsx(578,8): error TS2322: ...`. Continuation
  // (indented elaboration) lines lack this shape and are ignored.
  const re = /(?:^|\/)([^/\s]+\.tsx?)\(\d+,\d+\): error (TS\d+):/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output)) !== null) {
    const file = m[1]!;
    const code = m[2]!;
    (map[file] ??= {})[code] = ((map[file] ??= {})[code] ?? 0) + 1;
  }
  return map;
}

/** Run strict `tsc --noEmit` over one leaf's committed src; return raw + parsed. */
export function typecheckLeaf(spec: LeafSpec): LeafResult {
  const leafDir = resolve(ROOT, spec.leaf);
  const srcDir = join(leafDir, 'src');
  const leafNodeModules = join(leafDir, 'node_modules');

  // Fail LOUD on a setup gap rather than reporting a false green.
  if (!existsSync(srcDir)) {
    throw new Error(`[${spec.name}/${spec.target}] missing leaf src dir: ${srcDir}`);
  }
  if (!existsSync(leafNodeModules)) {
    throw new Error(
      `[${spec.name}/${spec.target}] missing leaf node_modules: ${leafNodeModules} — install/build the workspace first.`,
    );
  }
  // tsc from THIS package's pinned typescript.
  const tscBin = resolve(HERE, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tscBin)) {
    throw new Error(
      `[${spec.name}/${spec.target}] tsc not found at ${tscBin} — run pnpm install in tests/strict-conformance.`,
    );
  }

  const tmpDir = mkdtempSync(join(tmpdir(), `rozie-strict-${spec.name}-${spec.target}-`));
  try {
    // Copy every committed source entry: *.tsx/*.ts plus relative-import subdirs
    // (internal/ helpers, themes/). Skip dist/node_modules (never under src/).
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const from = join(srcDir, entry.name);
      const to = join(tmpDir, entry.name);
      if (entry.isDirectory()) {
        cpSync(from, to, { recursive: true });
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        copyFileSync(from, to);
      }
    }
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: strictCompilerOptions(spec.target),
          include: ['./**/*.ts', './**/*.tsx'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ),
    );
    // Ambient `any` stubs for vanilla-JS engine modules (merges harmlessly with
    // a leaf's real engine dep when one is installed).
    copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
    // Symlink the LEAF's node_modules so its real peer deps resolve.
    symlinkSync(leafNodeModules, join(tmpDir, 'node_modules'), 'dir');

    let output = '';
    try {
      // execFileSync throws on non-zero exit; tsc exits non-zero when it reports
      // errors (the report is on stdout).
      execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      output = stdout + '\n' + stderr;
    }
    return { raw: output, inventory: parseErrors(output) };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export interface CompiledTypecheckSpec {
  /** Compile target — drives the per-target strict tsconfig + JSX mode. */
  target: Target;
  /** `filename → emitted source` to write into the tmpdir and typecheck. */
  files: Record<string, string>;
  /**
   * Path (from repo ROOT) to a leaf package whose `node_modules` is symlinked
   * for type RESOLUTION (react/@types/react, solid-js, lit, @rozie/runtime-*).
   * A per-target committed leaf (e.g. `packages/ui/combobox/packages/react`)
   * carries exactly the right peer deps for `target`.
   */
  nodeModulesFrom: string;
}

/**
 * Strict `tsc --noEmit` over a set of EMITTED (compiled) source files written
 * to a tmpdir — the body-noise-free path for a DEDICATED `.rozie` fixture. Type
 * resolution comes from the symlinked leaf `node_modules`. Mirrors
 * `typecheckLeaf` but takes literal compiled source instead of a committed src/.
 */
export function typecheckCompiled(spec: CompiledTypecheckSpec): LeafResult {
  const nm = resolve(ROOT, spec.nodeModulesFrom, 'node_modules');
  if (!existsSync(nm)) {
    throw new Error(
      `[compiled/${spec.target}] missing node_modules for type resolution: ${nm} — install/build the workspace first.`,
    );
  }
  const tscBin = resolve(HERE, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tscBin)) {
    throw new Error(
      `[compiled/${spec.target}] tsc not found at ${tscBin} — run pnpm install in tests/strict-conformance.`,
    );
  }

  const tmpDir = mkdtempSync(join(tmpdir(), `rozie-strict-compiled-${spec.target}-`));
  try {
    for (const [name, code] of Object.entries(spec.files)) {
      writeFileSync(join(tmpDir, name), code);
    }
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: strictCompilerOptions(spec.target),
          include: ['./**/*.ts', './**/*.tsx'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ),
    );
    copyFileSync(join(HERE, 'engine-modules.d.ts'), join(tmpDir, 'engine-modules.d.ts'));
    symlinkSync(nm, join(tmpDir, 'node_modules'), 'dir');

    let output = '';
    try {
      execFileSync(tscBin, ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const stdout = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
      const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
      output = stdout + '\n' + stderr;
    }
    return { raw: output, inventory: parseErrors(output) };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Total error count across an inventory. */
export function totalErrors(inv: Inventory): number {
  return Object.values(inv).reduce(
    (sum, codes) => sum + Object.values(codes).reduce((s, n) => s + n, 0),
    0,
  );
}

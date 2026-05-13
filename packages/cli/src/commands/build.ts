// `rozie build` subcommand — D-87/D-88/D-89/D-90/D-91/D-93 multi-target build.
//
// As of Phase 6 Plan 03, the canonical entrypoint is `runBuildMatrix(inputs,
// opts)` — a single (input × target) matrix coordinator that:
//   • Expands variadic positional args via `expandInputs` (D-88 file/dir/glob)
//   • Validates the target list parsed by commander's `parseTargets` (D-87)
//   • Routes every per-tuple compile through `@rozie/core.compile()` — the
//     single source of truth shared with @rozie/unplugin and @rozie/babel-plugin
//     (D-93 byte-identical contract; Plan 06-06 parity gate enforces drift)
//   • Writes `dist/{target}/{source-rel}/Foo.{ext}` per D-89
//   • Emits .d.ts sidecars by default (D-90); --no-types opts out
//   • Suppresses .map sidecars by default (D-91); --source-map opts in
//   • Errors with ROZ855 when target=react and --out is null (sidecars cannot
//     stream to stdout)
//
// `runBuild` and `runBuildMany` are preserved as thin backward-compat wrappers
// — they delegate to runBuildMatrix with single-target coercion. ALL CLI
// pipelines now flow through `compile()`; the legacy parse → lowerToIR →
// emit{Target} chain has been removed from this file.
// Per the @rozie/unplugin pattern (transform.ts) and @rozie/core's own
// compile.ts: use RELATIVE imports into sibling workspace packages so the
// pipeline works whether or not dist/ has been built. tsdown inlines these
// at bundle time for the published artifact.
import { compile } from '../../../core/src/compile.js';
import { renderDiagnostic } from '../../../core/src/diagnostics/frame.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, resolve as pathResolve } from 'node:path';
import pc from 'picocolors';
import { expandInputs } from '../utils/expandInputs.js';
import { computeOutputPath } from '../utils/outputPath.js';
import type { Target } from '../utils/parseTargets.js';

/**
 * Legacy single-target options shape — preserved for `runBuild` /
 * `runBuildMany` backward-compat. New code should use `BuildOptionsExt`.
 */
export interface BuildOptions {
  target?: string;
  out?: string;
  sourceMap?: boolean;
}

/**
 * Phase 6 multi-target options shape consumed by `runBuildMatrix`.
 * Commander's `parseTargets` produces `target: Target[]`; programmatic callers
 * may pass either a single `Target` (e.g., from `runBuild`) or `Target[]`.
 */
export interface BuildOptionsExt {
  target?: Target | Target[];
  out?: string;
  /** D-91 default false — emit .map sidecars only when explicitly opted in. */
  sourceMap?: boolean;
  /** D-90 default true — emit .d.ts sidecars; --no-types maps to false. */
  types?: boolean;
  /** Project root used for source-rel-path computation; defaults to process.cwd(). */
  root?: string;
}

/**
 * Outcome enum for testability — runBuild itself calls process.exit when the
 * caller is the bin wrapper, but tests pass `exit: 'throw'` to convert the
 * exit-code into a thrown BuildExit so vitest can assert on it without the
 * test runner itself exiting. The third-party `commander.exitOverride` does
 * the same trick at the parser level; this is the same idea at the action
 * level.
 */
export class BuildExit extends Error {
  constructor(
    public readonly code: number,
    public readonly stderr: string,
  ) {
    super(`rozie build exited with code ${code}`);
    this.name = 'BuildExit';
  }
}

export interface RunBuildContext {
  /** When 'throw', exits become thrown BuildExit instead of process.exit. */
  exit?: 'process' | 'throw';
  /** stderr sink override — defaults to process.stderr.write. */
  stderrWrite?: (chunk: string) => void;
  /** stdout sink override — defaults to process.stdout.write. */
  stdoutWrite?: (chunk: string) => void;
}

const VALID_TARGETS = new Set<Target>(['vue', 'react', 'svelte', 'angular', 'solid', 'lit']);

/**
 * Phase 6 D-87/D-88/D-89/D-90/D-91/D-93 — the canonical build coordinator.
 *
 * @param inputArgs  positional args (files, directories, or globs)
 * @param opts       parsed options (target list, out, sourceMap, types, root)
 * @param ctx        test-injection sinks + exit-mode toggle
 */
export async function runBuildMatrix(
  inputArgs: string[],
  opts: BuildOptionsExt = {},
  ctx: RunBuildContext = {},
): Promise<void> {
  const stderrWrite = ctx.stderrWrite ?? ((s) => void process.stderr.write(s));
  const stdoutWrite = ctx.stdoutWrite ?? ((s) => void process.stdout.write(s));

  const exit = (code: number, stderrBuf = ''): never => {
    if (ctx.exit === 'throw') {
      throw new BuildExit(code, stderrBuf);
    }
    process.exit(code);
  };

  // ----- Normalize the target list -------------------------------------
  const targetsRaw: Target[] = Array.isArray(opts.target)
    ? opts.target
    : opts.target !== undefined
      ? [opts.target as Target]
      : ['vue'];

  // Defensive validation — commander's parseTargets already vets these, but
  // programmatic callers (runBuild/runBuildMany passthroughs, tests) might
  // bypass it.
  for (const t of targetsRaw) {
    if (!VALID_TARGETS.has(t)) {
      const msg = pc.red(
        `[ROZ850] rozie build: unknown target '${t}' (expected vue|react|svelte|angular|solid|lit)\n`,
      );
      stderrWrite(msg);
      exit(2, msg);
      return;
    }
  }
  const targets = targetsRaw;

  // ----- Expand inputs --------------------------------------------------
  let inputs: string[];
  try {
    inputs = await expandInputs(inputArgs);
  } catch (err) {
    const msg = pc.red(`${(err as Error).message}\n`);
    stderrWrite(msg);
    exit(1, msg);
    return;
  }

  if (inputs.length === 0) {
    const msg = pc.red(
      `[ROZ851] rozie build: no .rozie files matched the given inputs\n`,
    );
    stderrWrite(msg);
    exit(1, msg);
    return;
  }

  // ----- D-89 --out requirement ----------------------------------------
  // --out is required when (a) more than one input file or (b) more than one
  // target — both cases produce multiple output files per invocation.
  if ((inputs.length > 1 || targets.length > 1) && opts.out === undefined) {
    const msg = pc.red(
      `[ROZ852] rozie build: --out <dir> is required when compiling multiple files or multiple targets\n`,
    );
    stderrWrite(msg);
    exit(2, msg);
    return;
  }

  const outDir = opts.out !== undefined ? pathResolve(opts.out) : null;
  const rootDir = opts.root ?? process.cwd();
  const wantTypes = opts.types !== false; // D-90 default true
  const wantSourceMap = opts.sourceMap === true; // D-91 default false

  // ----- DIST-04 React-stdout sidecar guard ----------------------------
  // React emits .d.ts + .module.css + .global.css sidecars; these CANNOT
  // be streamed to stdout (no filename to attach to). When target=react and
  // --out is null, error with ROZ855 BEFORE any pipeline work runs.
  if (outDir === null) {
    for (const t of targets) {
      if (t === 'react') {
        const msg = pc.red(
          `[ROZ855] rozie build: target 'react' requires --out <dir> ` +
            `(cannot stream sidecar files .d.ts/.module.css/.global.css to stdout). ` +
            `Set --out <dir> to emit React components.\n`,
        );
        stderrWrite(msg);
        exit(2, msg);
        return;
      }
    }
  }

  // ----- Build (input × target) tuples ---------------------------------
  const tuples = inputs.flatMap((input) => targets.map((target) => ({ input, target })));

  // ----- Parallel compile (RESEARCH recommendation: Promise.all) -------
  const results = await Promise.all(
    tuples.map(async ({ input, target }) => {
      const source = readFileSync(input, 'utf8');
      const compileOpts = {
        target,
        filename: input,
        types: wantTypes,
        sourceMap: wantSourceMap,
      };
      const result = compile(source, compileOpts);
      return { input, target, source, result };
    }),
  );

  // ----- Write phase + diagnostic surfacing ----------------------------
  let failed = 0;
  for (const { input, target, source, result } of results) {
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

    if (errors.length > 0) {
      stderrWrite(renderAll(result.diagnostics, source));
      failed++;
      continue;
    }
    if (warnings.length > 0) {
      stderrWrite(renderAll(warnings, source));
    }

    if (outDir === null) {
      // Single-target single-input non-React case routed through stdout
      // (preserves runBuild backward-compat for vue/svelte/angular).
      stdoutWrite(result.code);
      continue;
    }

    const outPath = computeOutputPath(input, target, outDir, rootDir);
    mkdirSync(pathDirname(outPath), { recursive: true });
    writeFileSync(outPath, result.code, 'utf8');

    // D-90: .d.ts sibling for React (other targets emit '' per D-84)
    if (wantTypes && target === 'react' && result.types) {
      writeFileSync(outPath.replace(/\.tsx$/, '.d.ts'), result.types, 'utf8');
    }
    // React .module.css / .global.css siblings (D-53/D-54)
    if (target === 'react') {
      if (result.css !== undefined && result.css.length > 0) {
        writeFileSync(outPath.replace(/\.tsx$/, '.module.css'), result.css, 'utf8');
      }
      if (result.globalCss !== undefined && result.globalCss.length > 0) {
        writeFileSync(outPath.replace(/\.tsx$/, '.global.css'), result.globalCss, 'utf8');
      }
    }
    // D-91: .map sibling
    if (wantSourceMap && result.map) {
      writeFileSync(`${outPath}.map`, result.map.toString(), 'utf8');
    }
  }

  if (failed > 0) {
    const msg = pc.red(`rozie build: ${failed} of ${tuples.length} compilation(s) failed\n`);
    stderrWrite(msg);
    exit(1, msg);
  }
}

/**
 * Single-input single-target build — backward-compat thin wrapper around
 * `runBuildMatrix`. Kept stable for the existing test suite + CLI tests
 * predating Phase 6.
 */
export async function runBuild(
  input: string,
  opts: BuildOptions = {},
  ctx: RunBuildContext = {},
): Promise<void> {
  const target = (opts.target ?? 'vue') as Target;
  const ext: BuildOptionsExt = {
    target,
    ...(opts.out !== undefined ? { out: opts.out } : {}),
    ...(opts.sourceMap === true ? { sourceMap: true } : {}),
  };
  return runBuildMatrix([input], ext, ctx);
}

/**
 * Multi-input single-target build — backward-compat thin wrapper around
 * `runBuildMatrix`. The original semantics required `--out <dir>` for
 * multi-input invocations; runBuildMatrix preserves that via the D-89 guard.
 */
export async function runBuildMany(
  inputs: string[],
  opts: BuildOptions = {},
  ctx: RunBuildContext = {},
): Promise<void> {
  const target = (opts.target ?? 'vue') as Target;
  const ext: BuildOptionsExt = {
    target,
    ...(opts.out !== undefined ? { out: opts.out } : {}),
    ...(opts.sourceMap === true ? { sourceMap: true } : {}),
  };
  return runBuildMatrix(inputs, ext, ctx);
}

function renderAll(diagnostics: Diagnostic[], source: string): string {
  return diagnostics.map((d) => `${renderDiagnostic(d, source)}\n`).join('');
}

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
// Phase 22 Plan 22-05 — CLI sidecar fallback (REQ-5). The `.d.rozie.ts`
// per-module declaration is rendered by the SAME `renderSidecar` the unplugin
// uses (parse → lowerToIR → per-target emit<Target>Types dispatch → do-not-edit
// + sha256 hash header), so the unplugin and CLI sidecar bytes cannot drift.
// Relative import into the sibling workspace package (the CLI's established
// pattern; tsdown inlines it at bundle time).
import { renderSidecar } from '../../../unplugin/src/emitSidecar.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, resolve as pathResolve } from 'node:path';
import { TARGET_EXTENSIONS } from '../utils/outputPath.js';
import pc from 'picocolors';
import { expandInputs } from '../utils/expandInputs.js';
import { computeOutputPath } from '../utils/outputPath.js';
import type { Target } from '../utils/parseTargets.js';
import { prettyFormat } from '../utils/prettyFormat.js';

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
  /**
   * Opt-in: format emitted artefacts through prettier before write.
   * Off by default per PROJECT.md "Out of Scope" — v1's bar is "just
   * works", not "pretty output". When ON, applies prettier core to .tsx /
   * .ts / .d.ts / .vue / .css sidecars, and prettier-plugin-svelte to
   * .svelte. Source-map sidecars (.map) are never reformatted (spec-
   * required field ordering). Prettier failures degrade gracefully:
   * raw output is written and a warning prints to stderr.
   */
  pretty?: boolean;
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
 * Per-target extension used to derive a synthetic filename for the stdout
 * code path when --pretty is on. Mirrors TARGET_EXTENSIONS from
 * outputPath.ts but kept local to avoid coupling the build command to a
 * specific helper for a one-line need.
 */
const TARGET_STDOUT_EXT: Record<Target, string> = {
  vue: '.vue',
  react: '.tsx',
  svelte: '.svelte',
  angular: '.ts',
  solid: '.tsx',
  lit: '.ts',
};

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
  const wantPretty = opts.pretty === true; // off by default per PROJECT.md

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

  // Opt-in prettier pass — degrades to raw output on failure so a
  // prettier hiccup never blocks an otherwise-correct compile. Captured
  // in the outer scope so both the parallel matrix loop and the stdout
  // path can call it without re-allocating per tuple.
  const maybePretty = async (text: string, name: string): Promise<string> => {
    if (!wantPretty) return text;
    const r = await prettyFormat(text, name);
    if (!r.ok) {
      stderrWrite(
        pc.yellow(`[warning] --pretty failed for ${name}: ${r.error}; emitting unformatted\n`),
      );
    }
    return r.formatted;
  };

  // ----- Write phase (parallel across tuples + parallel per sidecar) ---
  // The compile phase above is already in Promise.all. Without --pretty,
  // the write loop is sync filesystem work and parallelism doesn't help
  // (Node's libuv pool is small). WITH --pretty, every tuple has 1-4
  // prettier calls that ARE worth parallelizing — at 6 targets × N inputs,
  // sequential awaiting would dominate. Promise.all both layers so an
  // N-file × 6-target matrix gets the full benefit.
  //
  // Diagnostic-stderr ordering is preserved per-tuple but interleaves
  // across tuples; that matches the existing compile-phase Promise.all
  // shape and isn't a regression.
  const writeResults = await Promise.all(
    results.map(async ({ input, target, source, result }): Promise<boolean> => {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

      if (errors.length > 0) {
        stderrWrite(renderAll(result.diagnostics, source));
        return true; // failed
      }
      if (warnings.length > 0) {
        stderrWrite(renderAll(warnings, source));
      }

      if (outDir === null) {
        // Single-target single-input non-React case routed through stdout
        // (preserves runBuild backward-compat for vue/svelte/angular).
        // Derive the parser hint from the target ext so --pretty still
        // picks the right parser even though no file is written.
        const stdoutName = `stdout${TARGET_STDOUT_EXT[target]}`;
        stdoutWrite(await maybePretty(result.code, stdoutName));
        return false;
      }

      const outPath = computeOutputPath(input, target, outDir, rootDir);
      mkdirSync(pathDirname(outPath), { recursive: true });

      // Phase 22 Plan 22-05 — `.d.rozie.ts` sidecar (REQ-5/REQ-7). Emitted for
      // ALL six targets via the same `renderSidecar` the unplugin uses, so a
      // CLI build and a bundler build produce byte-identical sidecars (ONE
      // convention for consumers). React ALSO keeps its existing `result.types`
      // `.d.ts` below (backward-compat) — the `.d.rozie.ts` is the cross-target
      // convention that `allowArbitraryExtensions` resolves for `./Foo.rozie`.
      //
      // REQ-7 (LOCKED GITIGNORED): `*.d.rozie.ts` is already matched by the
      // existing `.gitignore:29 *.rozie.ts` rule — these are generated artefacts,
      // ignore-not-commit. NO new gitignore rule is added.
      const sidecarText = wantTypes ? renderSidecar(source, target, input) : null;
      const sidecarPath =
        sidecarText !== null
          ? outPath.slice(0, outPath.length - TARGET_EXTENSIONS[target].length) + '.d.rozie.ts'
          : null;

      // Pre-compute sidecar paths + content so we can fire all prettier
      // calls for this tuple in parallel.
      const dtsPath =
        wantTypes && target === 'react' && result.types
          ? outPath.replace(/\.tsx$/, '.d.ts')
          : null;
      const modPath =
        target === 'react' && result.css !== undefined && result.css.length > 0
          ? outPath.replace(/\.tsx$/, '.module.css')
          : null;
      const globPath =
        target === 'react' && result.globalCss !== undefined && result.globalCss.length > 0
          ? outPath.replace(/\.tsx$/, '.global.css')
          : null;

      const [mainText, dtsText, modText, globText] = await Promise.all([
        maybePretty(result.code, outPath),
        dtsPath ? maybePretty(result.types ?? '', dtsPath) : Promise.resolve(null),
        modPath ? maybePretty(result.css ?? '', modPath) : Promise.resolve(null),
        globPath ? maybePretty(result.globalCss ?? '', globPath) : Promise.resolve(null),
      ]);

      // writeFileSync is sync — fine, libuv-bound work would queue here
      // anyway. Keeping these in source order also keeps the disk-write
      // failure mode predictable (main artefact lands before sidecars).
      writeFileSync(outPath, mainText, 'utf8');
      // Phase 22 Plan 22-05: `.d.rozie.ts` sidecar — written RAW (never
      // prettied) so the bytes stay identical to the unplugin's emitSidecar
      // output (the do-not-edit hash header must match for the staleness gate).
      if (sidecarPath !== null && sidecarText !== null) {
        writeFileSync(sidecarPath, sidecarText, 'utf8');
      }
      // D-90: React .d.ts sibling (other targets emit '' per D-84).
      if (dtsPath !== null && dtsText !== null) writeFileSync(dtsPath, dtsText, 'utf8');
      // D-53 / D-54: React .module.css / .global.css siblings.
      if (modPath !== null && modText !== null) writeFileSync(modPath, modText, 'utf8');
      if (globPath !== null && globText !== null) writeFileSync(globPath, globText, 'utf8');
      // D-91: .map sibling. NEVER prettied — source-map spec requires the
      // `mappings` VLQ field stay in a specific order that prettier-json
      // would rearrange. prettyFormat() also skips .map defensively.
      if (wantSourceMap && result.map) {
        writeFileSync(`${outPath}.map`, result.map.toString(), 'utf8');
      }
      return false;
    }),
  );

  const failed = writeResults.filter(Boolean).length;

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

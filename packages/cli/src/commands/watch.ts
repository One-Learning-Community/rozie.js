// `rozie watch` subcommand — chokidar-driven incremental recompile.
//
// Mirrors `rozie build`'s flag surface (--target, --out, --source-map,
// --no-types) but is long-running. Intended for a component-library
// author iterating on a .rozie file while a live framework dev server
// in another terminal consumes the emitted .tsx/.vue/.svelte/etc.
//
// Key behaviours (modelled on `tsc --watch` / `vite build --watch`):
//   • Always requires --out (no sense streaming to stdout from a daemon).
//   • Initial build runs the full input set once, so output exists when
//     the watcher arms; subsequent compiles are per-changed-file only.
//   • Debounced via chokidar's awaitWriteFinish (text editors fire
//     multiple events per save; 100 ms stability avoids spurious
//     re-compiles).
//   • Per-change log lines are timestamped + colourised; errors render
//     full diagnostic frames but DON'T tear the watcher down (tsc
//     --watch's behaviour — keep watching past compile errors).
//   • Graceful exit on SIGINT/SIGTERM: closes the watcher, prints a
//     "stopped" line, resolves runWatch() with exit code 0.
//
// The compile + write phase intentionally duplicates a small slice of
// build.ts (~30 lines) instead of refactoring out a shared writer.
// Drift risk is low (both call the same `compile()` core; the only
// per-target sidecar logic is React's .d.ts / .module.css / .global.css,
// which is stable). If the per-target sidecar matrix grows, the next
// editor of either file should hoist the shared helper.
import chokidar from 'chokidar';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname as pathDirname, resolve as pathResolve } from 'node:path';
import pc from 'picocolors';
import { compile } from '../../../core/src/compile.js';
import { renderDiagnostic } from '../../../core/src/diagnostics/frame.js';
// Phase 22 Plan 22-05 — CLI sidecar fallback (REQ-5): refresh the
// `.d.rozie.ts` per changed file via the SAME renderer the unplugin + build
// command use, so the watch-mode sidecar bytes don't drift.
import { renderSidecar } from '../../../unplugin/src/emitSidecar.js';
import { expandInputs } from '../utils/expandInputs.js';
import { computeOutputPath, TARGET_EXTENSIONS } from '../utils/outputPath.js';
import type { Target } from '../utils/parseTargets.js';
import { prettyFormat } from '../utils/prettyFormat.js';

export interface WatchOptions {
  target?: Target | Target[];
  out?: string;
  /** D-91 default false. */
  sourceMap?: boolean;
  /** D-90 default true. */
  types?: boolean;
  /** Project root for source-rel-path computation; defaults to process.cwd(). */
  root?: string;
  /**
   * Off by default per PROJECT.md "Out of Scope" carve-out. Pipes the
   * per-change emit through prettier before write. Failures degrade
   * gracefully — raw output still lands on disk + a stderr warning fires.
   */
  pretty?: boolean;
  /**
   * Phase 23 — Angular-only opt-out for the auto `ControlValueAccessor` emit.
   * Default ON; `false` maps to `compile({ angular: { cva: false } })`.
   * Mirrors the `rozie build` flag. No-op for non-Angular targets.
   */
  cva?: boolean;
}

export interface RunWatchContext {
  /** When 'throw', invalid-arg exits become thrown errors (vitest-friendly). */
  exit?: 'process' | 'throw';
  stderrWrite?: (chunk: string) => void;
  stdoutWrite?: (chunk: string) => void;
  /**
   * Test injection — when this AbortSignal fires, the watcher closes and
   * runWatch() resolves. Lets vitest drive the lifecycle without sending
   * real OS signals to the test process.
   */
  signal?: AbortSignal;
}

const VALID_TARGETS = new Set<Target>(['vue', 'react', 'svelte', 'angular', 'solid', 'lit']);

/**
 * Compact HH:MM:SS timestamp for log lines. en-US 24h matches what
 * `tsc --watch` does and reads cleanly in PR screenshots.
 */
function ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * `rozie watch <inputs...>` entry point. Performs one initial build of
 * the matched input set, then watches for changes and recompiles per
 * file. Resolves on graceful shutdown (SIGINT/SIGTERM or ctx.signal).
 */
export async function runWatch(
  inputArgs: string[],
  opts: WatchOptions = {},
  ctx: RunWatchContext = {},
): Promise<void> {
  const stderrWrite = ctx.stderrWrite ?? ((s) => void process.stderr.write(s));
  const stdoutWrite = ctx.stdoutWrite ?? ((s) => void process.stdout.write(s));

  const exit = (code: number, msg = ''): never => {
    if (msg) stderrWrite(msg);
    if (ctx.exit === 'throw') {
      throw new Error(`rozie watch exited with code ${code}: ${msg.trim()}`);
    }
    process.exit(code);
  };

  // ----- Normalize + validate the target list --------------------------
  const targets: Target[] = Array.isArray(opts.target)
    ? opts.target
    : opts.target !== undefined
      ? [opts.target as Target]
      : ['vue'];

  for (const t of targets) {
    if (!VALID_TARGETS.has(t)) {
      return exit(
        2,
        pc.red(
          `[ROZ850] rozie watch: unknown target '${t}' (expected vue|react|svelte|angular|solid|lit)\n`,
        ),
      );
    }
  }

  // ----- --out is REQUIRED for watch -----------------------------------
  // A long-running watcher cannot stream to stdout; nothing useful would
  // consume the unending sequence of per-change compile outputs.
  if (opts.out === undefined) {
    return exit(
      2,
      pc.red(
        `[ROZ856] rozie watch: --out <dir> is required (cannot stream to stdout from a long-running watcher)\n`,
      ),
    );
  }

  const outDir = pathResolve(opts.out);
  const rootDir = opts.root ?? process.cwd();
  const wantTypes = opts.types !== false;
  const wantSourceMap = opts.sourceMap === true;
  const wantPretty = opts.pretty === true;
  const cvaOff = opts.cva === false; // Phase 23 — Angular CVA opt-out

  // ----- Initial expansion + build -------------------------------------
  let inputs: string[];
  try {
    inputs = await expandInputs(inputArgs);
  } catch (err) {
    return exit(1, pc.red(`${(err as Error).message}\n`));
  }

  if (inputs.length === 0) {
    return exit(
      1,
      pc.red(`[ROZ851] rozie watch: no .rozie files matched the given inputs\n`),
    );
  }

  for (const input of inputs) {
    await compileOne(input, targets, outDir, rootDir, wantTypes, wantSourceMap, wantPretty, cvaOff, stderrWrite, stdoutWrite);
  }

  stdoutWrite(
    pc.cyan(
      `[${ts()}] watching ${inputs.length} file(s) for ${targets.join('+')} (Ctrl-C to stop)\n`,
    ),
  );

  // ----- Watcher setup -------------------------------------------------
  // Pass the raw input args through to chokidar — it handles files, dirs,
  // and globs natively (same way fast-glob did in expandInputs). For dir
  // args, chokidar recurses by default, so newly-added .rozie files are
  // picked up too. `ignoreInitial: true` is important: the initial build
  // loop above already emitted everything, so we don't want chokidar's
  // own initial scan to re-fire 'add' events for them.
  //
  // awaitWriteFinish coalesces editor-save bursts (Vim/Helix/VSCode all
  // emit multiple write events per save). 100 ms stability is the
  // standard tsc/vite tuning.
  const watcher = chokidar.watch(inputArgs, {
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 30 },
    ignoreInitial: true,
    ignored: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.turbo/**',
      '**/.planning/**',
    ],
  });

  const onUpsert = async (changedPath: string): Promise<void> => {
    if (!changedPath.endsWith('.rozie')) return;
    const abs = pathResolve(changedPath);
    await compileOne(abs, targets, outDir, rootDir, wantTypes, wantSourceMap, wantPretty, cvaOff, stderrWrite, stdoutWrite);
  };

  watcher.on('add', onUpsert);
  watcher.on('change', onUpsert);
  watcher.on('unlink', (removedPath) => {
    if (removedPath.endsWith('.rozie')) {
      stdoutWrite(
        pc.yellow(`[${ts()}] removed ${displayPath(removedPath, rootDir)} (output files left intact)\n`),
      );
    }
  });
  watcher.on('error', (err) => {
    // Watcher errors (e.g., EMFILE on Linux when too many files open) get
    // surfaced but don't tear the watcher down — chokidar internally
    // recovers from most. We log + keep going.
    stderrWrite(pc.red(`[${ts()}] watcher error: ${(err as Error).message}\n`));
  });

  // ----- Wait for shutdown signal --------------------------------------
  return new Promise<void>((resolve) => {
    let resolved = false;
    const cleanup = async (): Promise<void> => {
      if (resolved) return;
      resolved = true;
      stdoutWrite(pc.cyan(`\n[${ts()}] stopped.\n`));
      try {
        await watcher.close();
      } catch {
        // close() can reject if chokidar already torn down; swallow.
      }
      resolve();
    };
    if (ctx.signal) {
      ctx.signal.addEventListener('abort', () => {
        void cleanup();
      });
    }
    process.once('SIGINT', () => void cleanup());
    process.once('SIGTERM', () => void cleanup());
  });
}

/**
 * Compile one source file to all configured targets and emit each
 * artefact to disk. Mirrors the per-tuple write logic in build.ts
 * (`runBuildMatrix` lines 222-249). Errors render diagnostics but do
 * not throw — watch mode keeps running past compile failures.
 */
async function compileOne(
  inputAbs: string,
  targets: Target[],
  outDir: string,
  rootDir: string,
  wantTypes: boolean,
  wantSourceMap: boolean,
  wantPretty: boolean,
  cvaOff: boolean,
  stderrWrite: (s: string) => void,
  stdoutWrite: (s: string) => void,
): Promise<void> {
  // Local helper — matches the one in build.ts's runBuildMatrix loop. Kept
  // inline since the two write paths still diverge slightly (watch logs
  // a per-file summary line; build aggregates failure counts).
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
  const startedAt = Date.now();
  let source: string;
  try {
    source = readFileSync(inputAbs, 'utf8');
  } catch (err) {
    stderrWrite(
      pc.red(`[${ts()}] cannot read ${displayPath(inputAbs, rootDir)}: ${(err as Error).message}\n`),
    );
    return;
  }

  // Parallelize across targets — at 6 simultaneous --target invocations
  // with --pretty on, sequential await would dominate the per-change
  // latency. Each target's compile + write is independent (single source
  // file, target-private output paths). Use Promise.all to fan them out;
  // collect (target, errorCount) results back into ordered logging.
  const perTarget = await Promise.all(
    targets.map(async (target): Promise<{ target: Target; errors: number; emitted: boolean }> => {
      const result = compile(source, {
        target,
        filename: inputAbs,
        types: wantTypes,
        sourceMap: wantSourceMap,
        // Phase 23 — attach the `angular` namespace only on opt-out, so the
        // default-ON path stays byte-identical to unplugin/babel-plugin.
        ...(cvaOff ? { angular: { cva: false } } : {}),
      });

      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');

      if (errors.length > 0) {
        stderrWrite(errors.map((d) => `${renderDiagnostic(d, source)}\n`).join(''));
        return { target, errors: errors.length, emitted: false };
      }
      if (warnings.length > 0) {
        stderrWrite(warnings.map((d) => `${renderDiagnostic(d, source)}\n`).join(''));
      }

      const outPath = computeOutputPath(inputAbs, target, outDir, rootDir);
      mkdirSync(pathDirname(outPath), { recursive: true });

      // Phase 22 Plan 22-05 — `.d.rozie.ts` sidecar refresh per changed file
      // (REQ-5). Same `renderSidecar` dispatch as build.ts / the unplugin, so
      // a watch-driven re-emit produces byte-identical sidecars. Written RAW
      // (never prettied) to preserve the do-not-edit hash header.
      const sidecarText = wantTypes ? renderSidecar(source, target, inputAbs) : null;
      const sidecarPath =
        sidecarText !== null
          ? outPath.slice(0, outPath.length - TARGET_EXTENSIONS[target].length) + '.d.rozie.ts'
          : null;

      // Pre-compute sidecar paths so we can fire all per-tuple prettier
      // calls in parallel (mirrors the build.ts shape).
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

      writeFileSync(outPath, mainText, 'utf8');
      // Phase 22 Plan 22-05: `.d.rozie.ts` sidecar — RAW write (never prettied)
      // so the hash header bytes match the unplugin/build output.
      if (sidecarPath !== null && sidecarText !== null) {
        writeFileSync(sidecarPath, sidecarText, 'utf8');
      }
      if (dtsPath !== null && dtsText !== null) writeFileSync(dtsPath, dtsText, 'utf8');
      if (modPath !== null && modText !== null) writeFileSync(modPath, modText, 'utf8');
      if (globPath !== null && globText !== null) writeFileSync(globPath, globText, 'utf8');
      if (wantSourceMap && result.map) {
        writeFileSync(`${outPath}.map`, result.map.toString(), 'utf8');
      }
      return { target, errors: 0, emitted: true };
    }),
  );

  // Aggregate ordered by the original target list so the log line is
  // stable across runs (Promise.all preserves array index order in its
  // result, so perTarget[i].target === targets[i]).
  const emitted: Target[] = perTarget.filter((r) => r.emitted).map((r) => r.target);
  const totalErrors = perTarget.reduce((acc, r) => acc + r.errors, 0);

  const ms = Date.now() - startedAt;
  const path = displayPath(inputAbs, rootDir);
  if (totalErrors > 0 && emitted.length === 0) {
    stdoutWrite(pc.red(`[${ts()}] failed ${path} (${totalErrors} error${totalErrors === 1 ? '' : 's'})\n`));
  } else if (totalErrors > 0) {
    stdoutWrite(
      pc.yellow(
        `[${ts()}] partial ${path} → ${emitted.join(', ')} (${totalErrors} error${totalErrors === 1 ? '' : 's'} in other targets, ${ms}ms)\n`,
      ),
    );
  } else {
    stdoutWrite(
      pc.green(`[${ts()}] compiled ${pc.bold(path)} → ${emitted.join(', ')} (${ms}ms)\n`),
    );
  }
}

/**
 * Strip the rootDir prefix from a path for compact log output. Absolute
 * paths outside rootDir are passed through unmodified — matches what
 * users see in `tsc --watch` output.
 */
function displayPath(abs: string, rootDir: string): string {
  if (abs.startsWith(rootDir + '/')) return abs.slice(rootDir.length + 1);
  return abs;
}

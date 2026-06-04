// @rozie/cli — `rozie` command surface.
//
// `rozie build <inputs...>` runs each .rozie file through @rozie/core's
// compile() public API (DIST-01 / D-80) — the same single source of truth
// shared with @rozie/unplugin and @rozie/babel-plugin. Comma-separated
// `--target` (D-87), variadic file/dir/glob inputs (D-88), and the
// dist/{target}/{rel}/Foo.{ext} output layout (D-89) ship as of Phase 6
// Plan 03.
//
// runCli is exported separately from the bin shebang so tests can drive the
// CLI in-process without spawning a child node.
import { Command } from 'commander';
import {
  runBuild,
  runBuildMany,
  runBuildMatrix,
  type BuildOptions,
  type BuildOptionsExt,
} from './commands/build.js';
import { runWatch, type WatchOptions } from './commands/watch.js';
import { parseTargets, type Target } from './utils/parseTargets.js';

export { runBuild, runBuildMany, runBuildMatrix, runWatch };
export type { BuildOptions, BuildOptionsExt, WatchOptions };

/**
 * Internal — the parsed shape of `rozie build`'s opts after commander applies
 * the `parseTargets` parser. `target` is always `Target[]` post-parse (D-87);
 * `types` defaults true per Commander's `--no-*` semantics (D-90); `sourceMap`
 * defaults undefined/false (D-91).
 */
interface BuildCliOpts {
  target: Target[];
  out?: string;
  sourceMap?: boolean;
  types?: boolean;
  pretty?: boolean;
  /**
   * Phase 23 — Angular-only. Commander's `--no-cva` inverted boolean: present
   * on argv → `opts.cva === false`; absent → `opts.cva === true` (default ON).
   * Maps to `compile({ angular: { cva: false } })` when false.
   */
  cva?: boolean;
  /**
   * Phase 26 (D-11) — the GLOBAL safe-interpolation opt-out. Commander's
   * `--no-safe-interpolation` inverted boolean: present on argv →
   * `opts.safeInterpolation === false`; absent → `true` (default ON). Maps to
   * `compile({ safeInterpolation: false })` when false (cross-target — applies
   * to the five non-Vue targets).
   */
  safeInterpolation?: boolean;
}

/**
 * Programmatic entry — constructs the commander program and parses argv.
 * `argv` follows Node's `process.argv` shape (argv[0]=node, argv[1]=script).
 */
export async function runCli(argv: readonly string[]): Promise<void> {
  const program = new Command();
  program
    .name('rozie')
    .description('Rozie cross-framework component compiler CLI')
    .version('0.0.0')
    // Surface help on `rozie` with no args rather than the silent default.
    .showHelpAfterError();

  program
    .command('build <inputs...>')
    .description('Compile one or more .rozie files to one or more target frameworks')
    // D-87: comma-separated targets via parseTargets — validates each token.
    // Default ['vue'] preserves backward-compat with pre-Phase-6 invocations
    // that omitted --target entirely.
    .option(
      '-t, --target <names>',
      'target framework(s); comma-separated (vue|react|svelte|angular|solid|lit)',
      parseTargets,
      ['vue'] as Target[],
    )
    .option(
      '-o, --out <path>',
      'output directory (required for multiple inputs or multiple targets)',
    )
    // D-91: source maps default OFF.
    .option(
      '--source-map',
      'emit .map sidecar files (default off per D-91)',
    )
    // D-90: .d.ts emission default ON; --no-types opts out. Commander auto-
    // creates the inverted boolean: `--no-types` on argv → opts.types === false.
    .option(
      '--no-types',
      'skip .d.ts emission (React-only — no-op for inline-typed Vue/Svelte/Angular)',
    )
    // PROJECT.md "Out of Scope" carve-out: --pretty IS in scope for the
    // CLI specifically; just not v1's default. Off by default so the
    // dist-parity byte-equal gate (which routes through runBuildMatrix
    // without --pretty) stays inert.
    .option(
      '--pretty',
      'format emitted artefacts with prettier before write (off by default)',
    )
    // Phase 23 — Angular-only opt-out for the auto ControlValueAccessor emit.
    // Default ON; --no-cva → opts.cva === false → angular: { cva: false }.
    // Commander auto-creates the inverted boolean from the `--no-` prefix.
    .option(
      '--no-cva',
      'Angular-only: suppress the auto ControlValueAccessor emit on single-model components (no-op for other targets)',
    )
    // Phase 26 — GLOBAL opt-out for the safe-interpolation wrap (default ON).
    // --no-safe-interpolation → opts.safeInterpolation === false →
    // compile({ safeInterpolation: false }). Commander auto-creates the
    // inverted boolean from the `--no-` prefix. No-op for the Vue target.
    .option(
      '--no-safe-interpolation',
      'suppress the safe-interpolation rozieDisplay wrap (raw per-target emit; re-exposes the React object-child crash if a non-primitive is interpolated; no-op for Vue)',
    )
    .action(async (inputs: string[], opts: BuildCliOpts) => {
      const ext: BuildOptionsExt = {
        target: opts.target,
        ...(opts.out !== undefined ? { out: opts.out } : {}),
        ...(opts.sourceMap === true ? { sourceMap: true } : {}),
        ...(opts.types === false ? { types: false } : {}),
        ...(opts.pretty === true ? { pretty: true } : {}),
        ...(opts.cva === false ? { cva: false } : {}),
        ...(opts.safeInterpolation === false ? { safeInterpolation: false } : {}),
      };
      await runBuildMatrix(inputs, ext);
    });

  // `rozie watch <inputs...>` — chokidar-driven incremental recompile.
  // Mirrors the build flag surface but is long-running. --out is required
  // here (no sense streaming to stdout from a daemon); the watch command
  // surfaces that as ROZ856 at the action layer, not via commander.
  program
    .command('watch <inputs...>')
    .description(
      'Watch .rozie files and recompile on change (long-running; tsc --watch style)',
    )
    .option(
      '-t, --target <names>',
      'target framework(s); comma-separated (vue|react|svelte|angular|solid|lit)',
      parseTargets,
      ['vue'] as Target[],
    )
    .option(
      '-o, --out <path>',
      'output directory (required for watch mode)',
    )
    .option(
      '--source-map',
      'emit .map sidecar files (default off per D-91)',
    )
    .option(
      '--no-types',
      'skip .d.ts emission (React-only — no-op for inline-typed Vue/Svelte/Angular)',
    )
    .option(
      '--pretty',
      'format emitted artefacts with prettier before write (off by default)',
    )
    // Phase 23 — Angular-only opt-out, mirrors `rozie build` (default ON).
    .option(
      '--no-cva',
      'Angular-only: suppress the auto ControlValueAccessor emit on single-model components (no-op for other targets)',
    )
    // Phase 26 — GLOBAL safe-interpolation opt-out, mirrors `rozie build`.
    .option(
      '--no-safe-interpolation',
      'suppress the safe-interpolation rozieDisplay wrap (raw per-target emit; re-exposes the React object-child crash if a non-primitive is interpolated; no-op for Vue)',
    )
    .action(async (inputs: string[], opts: BuildCliOpts) => {
      const ext: WatchOptions = {
        target: opts.target,
        ...(opts.out !== undefined ? { out: opts.out } : {}),
        ...(opts.sourceMap === true ? { sourceMap: true } : {}),
        ...(opts.types === false ? { types: false } : {}),
        ...(opts.pretty === true ? { pretty: true } : {}),
        ...(opts.cva === false ? { cva: false } : {}),
        ...(opts.safeInterpolation === false ? { safeInterpolation: false } : {}),
      };
      await runWatch(inputs, ext);
    });

  // commander 14 returns a promise from parseAsync; await so any thrown errors
  // bubble to the bin wrapper.
  await program.parseAsync([...argv]);
}

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
import { parseTargets, type Target } from './utils/parseTargets.js';

export { runBuild, runBuildMany, runBuildMatrix };
export type { BuildOptions, BuildOptionsExt };

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
      'target framework(s); comma-separated (vue|react|svelte|angular|solid)',
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
    .action(async (inputs: string[], opts: BuildCliOpts) => {
      const ext: BuildOptionsExt = {
        target: opts.target,
        ...(opts.out !== undefined ? { out: opts.out } : {}),
        ...(opts.sourceMap === true ? { sourceMap: true } : {}),
        ...(opts.types === false ? { types: false } : {}),
      };
      await runBuildMatrix(inputs, ext);
    });

  // commander 14 returns a promise from parseAsync; await so any thrown errors
  // bubble to the bin wrapper.
  await program.parseAsync([...argv]);
}

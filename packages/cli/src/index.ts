// @rozie/cli — `rozie` command surface.
//
// `rozie build <input>` runs a .rozie file through @rozie/core's parse →
// lowerToIR pipeline and dispatches to one of the four target emitters
// (@rozie/target-{vue,react,svelte,angular}), then prints (or writes) the
// resulting per-framework source.
//
// runCli is exported separately from the bin shebang so tests can drive the
// CLI in-process without spawning a child node.
import { Command } from 'commander';
import { runBuild, runBuildMany, type BuildOptions } from './commands/build.js';

export { runBuild, runBuildMany };
export type { BuildOptions };

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
    .description('Compile one or more .rozie files to a target framework')
    .option(
      '-t, --target <name>',
      'target framework (vue|react|svelte|angular)',
      'vue',
    )
    .option(
      '-o, --out <path>',
      'write output to file or directory instead of stdout (required for multiple inputs)',
    )
    .option(
      '--source-map',
      'when --out is set, also write `<out>.map` for the chosen target',
    )
    .action(async (inputs: string[], opts: BuildOptions) => {
      if (inputs.length === 1) {
        // inputs[0] is guaranteed defined by the length guard; ! needed for noUncheckedIndexedAccess.
        await runBuild(inputs[0]!, opts);
      } else {
        await runBuildMany(inputs, opts);
      }
    });

  // commander 14 returns a promise from parseAsync; await so any thrown errors
  // bubble to the bin wrapper.
  await program.parseAsync([...argv]);
}

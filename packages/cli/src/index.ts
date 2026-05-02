// @rozie/cli — `rozie` command surface.
//
// This spike ships a single subcommand: `rozie build <input>`. It runs a
// .rozie file through @rozie/core's parse → lowerToIR pipeline and feeds the
// IR into @rozie/target-vue's emitVue, then prints (or writes) the resulting
// .vue SFC. Other targets (react/svelte/angular) error with a "not yet
// shipped" message until their phases land.
//
// runCli is exported separately from the bin shebang so tests can drive the
// CLI in-process without spawning a child node.
import { Command } from 'commander';
import { runBuild, type BuildOptions } from './commands/build.js';

export { runBuild };
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
    .command('build <input>')
    .description('Compile a .rozie file to a target framework')
    .option(
      '-t, --target <name>',
      'target framework (vue|react|svelte|angular)',
      'vue',
    )
    .option('-o, --out <file>', 'write output to file instead of stdout')
    .option(
      '--source-map',
      'when --out is set, also write `<out>.map` (vue target only)',
    )
    .action(async (input: string, opts: BuildOptions) => {
      await runBuild(input, opts);
    });

  // commander 14 returns a promise from parseAsync; await so any thrown errors
  // bubble to the bin wrapper.
  await program.parseAsync([...argv]);
}

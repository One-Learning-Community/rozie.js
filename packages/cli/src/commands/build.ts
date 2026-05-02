// `rozie build` subcommand — Task 1 placeholder. Task 2 wires the real
// parse → lower → emitVue pipeline, file write, and diagnostic rendering.
// This stub exists so the CLI surface (commander wiring, bin shebang,
// tsdown build) is its own atomic commit.

export interface BuildOptions {
  target?: string;
  out?: string;
  sourceMap?: boolean;
}

export async function runBuild(_input: string, _opts: BuildOptions): Promise<void> {
  // eslint-disable-next-line no-console
  console.error('rozie build: not yet implemented (Task 2 wires the pipeline)');
  process.exit(1);
}

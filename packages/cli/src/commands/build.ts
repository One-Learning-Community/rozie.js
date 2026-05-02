// `rozie build` subcommand — runs parse → lowerToIR → emitVue and writes (or
// prints) the resulting .vue SFC.
//
// This is a v0 spike: vue is the only shipped target. React/Svelte/Angular
// exit with a "not yet shipped" message until their target packages land in
// later phases. The pipeline shape mirrors @rozie/unplugin's runRoziePipeline
// (ParseResult → LowerResult → EmitVueResult, diagnostics surfaced via
// renderDiagnostic, errors -> exit 1, warnings -> stderr + continue).
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve as pathResolve, join as pathJoin, basename as pathBasename } from 'node:path';
import pc from 'picocolors';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { renderDiagnostic } from '../../../core/src/diagnostics/frame.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import { emitVue } from '../../../targets/vue/src/emitVue.js';

export interface BuildOptions {
  target?: string;
  out?: string;
  sourceMap?: boolean;
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

const VALID_TARGETS = new Set(['vue', 'react', 'svelte', 'angular']);

const TARGET_EXTENSIONS: Record<string, string> = {
  vue: '.vue',
  react: '.jsx',
  svelte: '.svelte',
  angular: '.js',
};

// Map of not-yet-shipped targets -> the phase that lands them. Source of
// truth: ROADMAP.md. Sync this map when each target's emitter ships.
const TARGET_PHASE: Record<string, string> = {
  react: 'Phase 4',
  svelte: 'Phase 5',
  angular: 'Phase 5',
};

export async function runBuild(
  input: string,
  opts: BuildOptions = {},
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

  // ----- Target validation ----------------------------------------------
  const target = opts.target ?? 'vue';
  if (!VALID_TARGETS.has(target)) {
    const msg = pc.red(
      `rozie build: unknown target '${target}' (expected vue|react|svelte|angular)\n`,
    );
    stderrWrite(msg);
    exit(2, msg);
  }
  if (target !== 'vue') {
    const phase = TARGET_PHASE[target] ?? 'a future phase';
    const msg = pc.red(
      `rozie build: target '${target}' not yet shipped — see ROADMAP.md (${phase})\n`,
    );
    stderrWrite(msg);
    exit(2, msg);
  }

  // ----- Read input ------------------------------------------------------
  const filePath = pathResolve(input);
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (err) {
    const msg = pc.red(
      `rozie build: cannot read '${input}': ${(err as Error).message}\n`,
    );
    stderrWrite(msg);
    exit(1, msg);
    return; // unreachable; satisfies ts narrowing
  }

  // ----- Pipeline: parse -> lowerToIR -> emitVue ------------------------
  const { ast, diagnostics: parseDiags } = parse(source, { filename: filePath });

  const parseErrors = parseDiags.filter((d) => d.severity === 'error');
  if (!ast || parseErrors.length > 0) {
    const stderrBuf = renderAll(parseDiags, source);
    stderrWrite(stderrBuf);
    exit(1, stderrBuf);
    return;
  }

  const registry = createDefaultRegistry();
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
  });
  const irErrors = irDiags.filter((d) => d.severity === 'error');
  if (!ir || irErrors.length > 0) {
    const stderrBuf = renderAll(irDiags, source);
    stderrWrite(stderrBuf);
    exit(1, stderrBuf);
    return;
  }

  const result = emitVue(ir, {
    filename: filePath,
    source,
    modifierRegistry: registry,
  });
  const emitErrors = result.diagnostics.filter((d) => d.severity === 'error');
  if (emitErrors.length > 0) {
    const stderrBuf = renderAll(result.diagnostics, source);
    stderrWrite(stderrBuf);
    exit(1, stderrBuf);
    return;
  }

  // Surface non-fatal warnings (parse + lower + emit) to stderr but continue.
  const allWarnings: Diagnostic[] = [
    ...parseDiags.filter((d) => d.severity === 'warning'),
    ...irDiags.filter((d) => d.severity === 'warning'),
    ...result.diagnostics.filter((d) => d.severity === 'warning'),
  ];
  if (allWarnings.length > 0) {
    stderrWrite(renderAll(allWarnings, source));
  }

  // ----- Output ----------------------------------------------------------
  if (opts.out) {
    let outPath = pathResolve(opts.out);

    // If --out points at an existing directory, write to <dir>/<input-basename>.<target-ext>.
    // throwIfNoEntry: false makes a missing path a non-error — we treat it as a new file path.
    const outStat = statSync(outPath, { throwIfNoEntry: false });
    if (outStat?.isDirectory()) {
      const pathExtension = TARGET_EXTENSIONS[target];
      outPath = pathJoin(outPath, pathBasename(filePath, '.rozie') + pathExtension);
    }

    writeFileSync(outPath, result.code, 'utf8');
    if (opts.sourceMap && result.map) {
      // magic-string SourceMap has a .toString() that emits canonical JSON.
      writeFileSync(`${outPath}.map`, result.map.toString(), 'utf8');
    }
  } else {
    stdoutWrite(result.code);
  }
}

function renderAll(diagnostics: Diagnostic[], source: string): string {
  return diagnostics.map((d) => `${renderDiagnostic(d, source)}\n`).join('');
}

import { compile, renderDiagnostic } from '@rozie/core';
import type { CompileTarget } from '@rozie/core';

export type CompileOutcome =
  | { ok: true; code: string }
  | { ok: false; errorText: string };

/**
 * Thin wrapper around @rozie/core compile(). Always returns a structured
 * outcome — never throws to the caller — so the UI layer can just render the
 * payload into the read-only Monaco pane.
 *
 * Why `resolverRoot: '/'` is passed explicitly: it short-circuits the
 * `opts.resolverRoot ?? process.cwd()` fallback inside compile.ts. This is
 * the load-bearing reason `process.cwd` is NOT shimmed via Vite `define` —
 * the call site is unreachable when `resolverRoot` is provided.
 */
export function compileBuffer(source: string, target: CompileTarget): CompileOutcome {
  try {
    const result = compile(source, {
      target,
      filename: 'Playground.rozie',
      resolverRoot: '/',
      types: false,
      sourceMap: false,
    });

    const hasError = result.diagnostics.some((d) => d.severity === 'error');
    if (hasError) {
      return {
        ok: false,
        errorText: result.diagnostics
          .map((d) => renderDiagnostic(d, source))
          .join('\n\n'),
      };
    }

    return { ok: true, code: result.code };
  } catch (e) {
    // Safety net for the throw-on-call shims: if a user types a <script>
    // import that drives @rozie/core into a code path needing readFileSync /
    // createRequire / userland resolver, that throws surface here. D-81 says
    // compile() never throws, so this branch is the playground-shim contract.
    return {
      ok: false,
      errorText:
        'Internal playground error: ' +
        (e instanceof Error ? e.stack ?? e.message : String(e)),
    };
  }
}

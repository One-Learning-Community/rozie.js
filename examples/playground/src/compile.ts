import { compile, renderDiagnostic, type CompileTarget } from '@rozie/core';
import type { Snippet } from './snippets';

export type CompileOutcome =
  | { ok: true; code: string; css: string }
  | { ok: false; errorText: string };

export type AllTargetsOutcome = Record<CompileTarget, CompileOutcome>;

export const ALL_TARGETS: readonly CompileTarget[] = [
  'react',
  'vue',
  'svelte',
  'angular',
  'solid',
  'lit',
];

/**
 * Compile a snippet bundle for one target. The bundle's `files` map is
 * exposed to @rozie/core via `globalThis.__rozieVfs` so that `<components>`
 * imports resolve against sibling files in the bundle (via the VFS-backed
 * shims in src/shims/). Single-file snippets just have one entry in `files`.
 *
 * The VFS is cleared after compilation so a stale entry can't satisfy a
 * later compile by accident.
 *
 * Always returns a structured outcome — never throws to the caller — so the
 * UI layer can just render the payload into the read-only Monaco pane.
 *
 * Why `resolverRoot: '/vfs'` is passed explicitly: it short-circuits the
 * `opts.resolverRoot ?? process.cwd()` fallback inside compile.ts. This is
 * the load-bearing reason `process.cwd` is NOT shimmed via Vite `define` —
 * the call site is unreachable when `resolverRoot` is provided.
 */
export function compileBundle(snippet: Snippet, target: CompileTarget): CompileOutcome {
  // Populate the VFS with /vfs/-prefixed absolute paths so the resolver's
  // joinPath logic (which assumes absolute fromDir) produces hits.
  const vfs = new Map<string, string>();
  for (const [filename, source] of Object.entries(snippet.files)) {
    vfs.set('/vfs/' + filename, source);
  }
  globalThis.__rozieVfs = vfs;

  const entrySource = snippet.files[snippet.entry];
  if (entrySource === undefined) {
    globalThis.__rozieVfs = undefined;
    return {
      ok: false,
      errorText: `[playground] snippet '${snippet.key}' has no entry source for '${snippet.entry}'`,
    };
  }

  try {
    const result = compile(entrySource, {
      target,
      filename: '/vfs/' + snippet.entry,
      resolverRoot: '/vfs',
      types: false,
      sourceMap: false,
    });

    const hasError = result.diagnostics.some((d) => d.severity === 'error');
    if (hasError) {
      return {
        ok: false,
        errorText: result.diagnostics
          .map((d) => renderDiagnostic(d, entrySource))
          .join('\n\n'),
      };
    }

    return { ok: true, code: result.code, css: result.css ?? '' };
  } catch (e) {
    // Safety net for the throw-on-call shims: if a user types a <script>
    // import that drives @rozie/core into a code path needing a code path
    // not covered by the VFS shims, that throws surface here. D-81 says
    // compile() never throws, so this branch is the playground-shim contract.
    return {
      ok: false,
      errorText:
        'Internal playground error: ' +
        (e instanceof Error ? e.stack ?? e.message : String(e)),
    };
  } finally {
    globalThis.__rozieVfs = undefined;
  }
}

/**
 * Compile a snippet for every target. Used by the "compare all" grid mode.
 * Each target gets its own compile() pass with a freshly-populated VFS so
 * compile-time state (IR cache, diagnostics) doesn't leak across targets.
 */
export function compileBundleAll(snippet: Snippet): AllTargetsOutcome {
  const out = {} as AllTargetsOutcome;
  for (const target of ALL_TARGETS) {
    out[target] = compileBundle(snippet, target);
  }
  return out;
}

/**
 * Back-compat wrapper used by the existing single-buffer Output pane:
 * compileBuffer(source, target) keeps working by treating the buffer as a
 * one-file bundle. The Output pane will still surface ROZ945 for any
 * snippet that authors a `<components>` import without sibling files —
 * this exactly matches the pre-bundle behavior.
 */
export function compileBuffer(source: string, target: CompileTarget): CompileOutcome {
  return compileBundle(
    {
      key: '__buffer__',
      label: '__buffer__',
      entry: 'Playground.rozie',
      files: { 'Playground.rozie': source },
    },
    target,
  );
}

/**
 * Per-bundle runtime compile outcome. Unlike `compileBundle` (which only
 * surfaces the entry's emitted code for the Output pane), this variant also
 * compiles every sibling .rozie file in the bundle so the iframe harness can
 * mint a blob URL per sibling and rewrite the entry's `./<basename>` import
 * specifiers to point at those blob URLs.
 *
 * The `siblings` map is keyed by basename (no `.rozie` extension) — that's
 * what the entry's compiled `import X from './X'` statement references after
 * the Rozie compiler resolves the `<components>` block.
 *
 * The top-level `css` field concatenates entry-css + every sibling-css for
 * the React sidecar path. Other targets inline CSS into the component module
 * itself and ignore this field.
 */
export interface BundleRuntimeOk {
  ok: true;
  entry: { code: string; css: string };
  siblings: Record<string, string>;
  css: string;
}

export type BundleRuntimeOutcome =
  | BundleRuntimeOk
  | { ok: false; errorText: string };

export type AllTargetsBundleRuntimeOutcome = Record<CompileTarget, BundleRuntimeOutcome>;

function basenameNoExt(filename: string): string {
  const last = filename.split('/').pop() ?? filename;
  return last.replace(/\.rozie$/, '');
}

/**
 * Compile a snippet bundle's entry AND every sibling for one target so the
 * iframe harness can wire them together via blob URLs. See `BundleRuntimeOk`
 * for the result shape.
 *
 * On any per-file compile error (entry or sibling), short-circuits with
 * `{ ok: false }` — bundle render requires every file to compile cleanly.
 */
export function compileBundleRuntime(
  snippet: Snippet,
  target: CompileTarget,
): BundleRuntimeOutcome {
  const vfs = new Map<string, string>();
  for (const [filename, source] of Object.entries(snippet.files)) {
    vfs.set('/vfs/' + filename, source);
  }
  globalThis.__rozieVfs = vfs;

  const entrySource = snippet.files[snippet.entry];
  if (entrySource === undefined) {
    globalThis.__rozieVfs = undefined;
    return {
      ok: false,
      errorText: `[playground] snippet '${snippet.key}' has no entry source for '${snippet.entry}'`,
    };
  }

  try {
    // Compile entry.
    const entryResult = compile(entrySource, {
      target,
      filename: '/vfs/' + snippet.entry,
      resolverRoot: '/vfs',
      types: false,
      sourceMap: false,
    });
    const entryHasError = entryResult.diagnostics.some((d) => d.severity === 'error');
    if (entryHasError) {
      return {
        ok: false,
        errorText: entryResult.diagnostics
          .map((d) => renderDiagnostic(d, entrySource))
          .join('\n\n'),
      };
    }
    const entryCss = entryResult.css ?? '';

    // Compile every non-entry file.
    const siblings: Record<string, string> = {};
    const siblingCssParts: string[] = [];
    for (const [filename, source] of Object.entries(snippet.files)) {
      if (filename === snippet.entry) continue;
      const siblingResult = compile(source, {
        target,
        filename: '/vfs/' + filename,
        resolverRoot: '/vfs',
        types: false,
        sourceMap: false,
      });
      const siblingHasError = siblingResult.diagnostics.some((d) => d.severity === 'error');
      if (siblingHasError) {
        return {
          ok: false,
          errorText: siblingResult.diagnostics
            .map((d) => renderDiagnostic(d, source))
            .join('\n\n'),
        };
      }
      siblings[basenameNoExt(filename)] = siblingResult.code;
      if (siblingResult.css) siblingCssParts.push(siblingResult.css);
    }

    const concatenatedCss = [entryCss, ...siblingCssParts].filter(Boolean).join('\n');

    return {
      ok: true,
      entry: { code: entryResult.code, css: entryCss },
      siblings,
      css: concatenatedCss,
    };
  } catch (e) {
    return {
      ok: false,
      errorText:
        'Internal playground error: ' +
        (e instanceof Error ? e.stack ?? e.message : String(e)),
    };
  } finally {
    globalThis.__rozieVfs = undefined;
  }
}

/**
 * Compile a snippet bundle's entry + every sibling for every target. Used by
 * the "compare all" grid mode so each iframe receives its own per-target
 * sibling map.
 */
export function compileBundleAllRuntime(snippet: Snippet): AllTargetsBundleRuntimeOutcome {
  const out = {} as AllTargetsBundleRuntimeOutcome;
  for (const target of ALL_TARGETS) {
    out[target] = compileBundleRuntime(snippet, target);
  }
  return out;
}

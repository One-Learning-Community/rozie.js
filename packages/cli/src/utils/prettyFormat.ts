// prettyFormat — opt-in `--pretty` formatting for emitted CLI artefacts.
//
// Used by `rozie build --pretty` and `rozie watch --pretty`. Off by
// default per PROJECT.md "Out of Scope" carve-out: "Output prettiness
// is a v2 concern … Available behind --pretty for CLI codegen."
//
// Parser-by-filename strategy: derive the right prettier parser from the
// output extension, NOT from the target name, so React .module.css /
// .global.css / .d.ts sidecars get formatted too.
//
// Plugin scope:
//   • prettier core (built-in parsers): typescript (.tsx, .ts, .d.ts),
//     vue (.vue), css (.css / .module.css / .global.css)
//   • prettier-plugin-svelte (separate dep): svelte (.svelte)
//   • Lit / Angular / Solid all emit .ts or .tsx — they ride built-in.
//   • Source-map sidecars (.map) are skipped — they're JSON-shaped but
//     must stay byte-stable for source-map consumers; reformatting would
//     break the spec-required ordering of the `mappings` field.
//
// Failure mode: prettier errors are surfaced as warnings, not hard
// failures. The compile output is already correct; --pretty is purely
// cosmetic. Returning ok=false lets the caller emit the raw output and
// log a degradation warning, mirroring what tsc does on a comment-formatter
// crash — the build keeps going.
import { format as prettierFormat } from 'prettier';

/**
 * Result of a single pretty-format attempt. `ok: false` carries the
 * original (unformatted) source in `formatted` so callers can fall
 * through to writing it unmodified.
 */
export interface PrettyResult {
  ok: boolean;
  formatted: string;
  /** Present only when ok=false — short diagnostic for the caller to log. */
  error?: string;
}

/**
 * Map of file-extension → prettier parser name. Longer extensions take
 * precedence (`.d.ts` before `.ts`, `.module.css` before `.css`) so the
 * sidecar shapes route correctly. `null` marks an extension we
 * intentionally never format.
 */
const PARSER_BY_EXT: ReadonlyArray<readonly [string, string | null]> = [
  ['.d.ts', 'typescript'],
  ['.module.css', 'css'],
  ['.global.css', 'css'],
  ['.tsx', 'typescript'],
  ['.svelte', 'svelte'],
  ['.vue', 'vue'],
  ['.css', 'css'],
  ['.ts', 'typescript'],
  // Never format — source maps must preserve spec-exact field ordering.
  ['.map', null],
];

/**
 * Cached prettier-plugin-svelte handle. Loaded lazily on first .svelte
 * format request so a user who only builds React/Vue doesn't pay the
 * import cost. Set to `false` if loading fails so subsequent attempts
 * short-circuit instead of re-throwing.
 */
let sveltePluginCache: unknown | false | undefined;

async function loadSveltePlugin(): Promise<unknown | false> {
  if (sveltePluginCache !== undefined) return sveltePluginCache;
  try {
    const mod = await import('prettier-plugin-svelte');
    // Some plugin builds put the export on .default, some on the module
    // namespace itself. Try both.
    sveltePluginCache = (mod as { default?: unknown }).default ?? mod;
  } catch {
    sveltePluginCache = false;
  }
  return sveltePluginCache;
}

/**
 * Format `source` using the prettier parser matching `filename`'s
 * extension. Never throws — failures return `{ ok: false, formatted:
 * source, error }` so the caller can fall through to writing the raw
 * (unformatted) emit and log a degradation warning.
 *
 * @param source   the raw emit text
 * @param filename the output filename (used only for parser detection)
 */
export async function prettyFormat(
  source: string,
  filename: string,
): Promise<PrettyResult> {
  let parser: string | null = null;
  for (const [ext, p] of PARSER_BY_EXT) {
    if (filename.endsWith(ext)) {
      parser = p;
      break;
    }
  }

  if (parser === null) {
    // Either a never-format extension (.map) or an unknown one. Either
    // way, return the source untouched without flagging an error — the
    // caller wrote a real file, just not a pretty one.
    return { ok: true, formatted: source };
  }

  const plugins: unknown[] = [];
  if (parser === 'svelte') {
    const plugin = await loadSveltePlugin();
    if (plugin === false) {
      return {
        ok: false,
        formatted: source,
        error:
          'prettier-plugin-svelte is not installed (required for --pretty + .svelte output)',
      };
    }
    plugins.push(plugin);
  }

  try {
    // `as` cast: prettier's plugin type is intentionally loose (`Plugin`),
    // and `unknown[]` here is the safest shape we can hand it without
    // pulling in @types/prettier-plugin-svelte (which doesn't exist).
    const formatted = await prettierFormat(source, {
      parser,
      // biome-ignore lint/suspicious/noExplicitAny: prettier plugin types are loose
      plugins: plugins as any,
    });
    return { ok: true, formatted };
  } catch (err) {
    return {
      ok: false,
      formatted: source,
      error: (err as Error).message,
    };
  }
}

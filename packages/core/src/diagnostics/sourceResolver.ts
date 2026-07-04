/**
 * Shared, sync, cached, never-throwing per-diagnostic source-text resolver
 * (Part 2 of the partial-origin diagnostic-attribution fix).
 *
 * A diagnostic whose `loc.filename` points at a spliced `.rzts`/`.rzjs`
 * partial must be rendered against THAT file's own text — never the host
 * `.rozie` source — so line/column and code frames are correct. This
 * factory builds one resolver per compile/build invocation, scoped by an
 * in-memory `Map<string, string>` cache (bounded by the number of distinct
 * files touched by that single invocation).
 *
 * Contract:
 *   - `filename` undefined, or === hostFilename → return `hostSource`
 *     immediately (no disk read; the common host-origin case).
 *   - cache hit → return cached text.
 *   - cache miss → `readFileSync(filename, 'utf8')` inside try/catch:
 *       - success → cache + return the partial's text.
 *       - failure (missing/unreadable path) → cache the HOST source under
 *         that key and return it. NEVER throws — mirrors
 *         inlineScriptPartials' collected-not-thrown discipline (D-08).
 *
 * SYNC only — no IRCache/ProducerResolver plumbing; this is a tiny,
 * self-contained diagnostics-rendering concern.
 */
import { readFileSync } from 'node:fs';

export function createSourceResolver(
  hostFilename: string | undefined,
  hostSource: string,
): (filename?: string) => string {
  const cache = new Map<string, string>();
  return (filename?: string): string => {
    if (filename === undefined || filename === hostFilename) return hostSource;
    const cached = cache.get(filename);
    if (cached !== undefined) return cached;
    let text: string;
    try {
      text = readFileSync(filename, 'utf8');
    } catch {
      text = hostSource;
    }
    cache.set(filename, text);
    return text;
  };
}

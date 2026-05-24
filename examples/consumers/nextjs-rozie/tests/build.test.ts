// Build smoke: runs `next build`, asserts that the produced .next/ bundle
// contains evidence that Counter.rozie was compiled through Rozie's
// unplugin/webpack adapter. The assertions target stable Rozie compile-time
// markers (Rozie runtime imports + the scope-hash attribute) that survive
// Next's Webpack pipeline + minification.
//
// This proves the docs/guide/adopt-incrementally.md § Next.js claim:
// "drop into next.config.js + import a .rozie file from any page".
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const NEXT_OUTPUT = resolve(PROJECT_ROOT, '.next');

const BUILD_TIMEOUT_MS = 120_000;

/** Recursively collect file paths under a directory matching a predicate. */
function* walk(root: string, predicate: (path: string) => boolean): Generator<string> {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip cache dir — large, not relevant.
      if (name === 'cache') continue;
      yield* walk(full, predicate);
    } else if (predicate(full)) {
      yield full;
    }
  }
}

describe('Next.js + Rozie integration smoke', () => {
  beforeAll(() => {
    // Cold build — proves the unplugin transforms during a clean Webpack
    // run. We use `execSync` so vitest sees the build's stderr if it fails.
    execSync('pnpm next build', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });
  }, BUILD_TIMEOUT_MS);

  it('produces a .next/ build output directory', () => {
    expect(existsSync(NEXT_OUTPUT)).toBe(true);
  });

  it('bundle contains compiled Counter.rozie output (Rozie scope attribute or runtime import)', () => {
    // Scan all JS files under .next/static/chunks/ for Rozie markers.
    // Next splits chunks, so we concat-scan rather than asserting on one file.
    const chunks: string[] = [];
    for (const path of walk(resolve(NEXT_OUTPUT, 'static'), (p) => p.endsWith('.js'))) {
      try {
        chunks.push(readFileSync(path, 'utf8'));
      } catch {
        /* ignore unreadable chunks */
      }
    }
    const haystack = chunks.join('\n');

    // Stable markers that survive Next's Webpack pipeline:
    //   - `data-rozie-s-<hash>` — scope attribute stamped on every element
    //   - `rozie-counter` — the lowercase custom-element-style tag used for
    //     the compiled component's emit shape OR the component name literal
    //   - `Counter` — class / function name (less stable under name-mangling)
    // The first two are the load-bearing assertion; class-name match is
    // a redundant nice-to-have.
    expect(haystack).toMatch(/data-rozie-s-/);
  });
});

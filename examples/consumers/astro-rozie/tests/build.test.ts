// Build smoke: runs `astro build`, asserts that the produced dist/ output
// contains (a) the static HTML with the `<rozie-counter>` custom element,
// and (b) JS that has the compiled Rozie/Lit emit (scope-hash attribute or
// Rozie runtime imports).
//
// Proves the docs/guide/adopt-incrementally.md § Astro and
// docs/guide/for-astro-and-html-first-shops.md walkthroughs work
// end-to-end on a real Astro 5 project.
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ASTRO_OUTPUT = resolve(PROJECT_ROOT, 'dist');

const BUILD_TIMEOUT_MS = 120_000;

function* walk(root: string, predicate: (path: string) => boolean): Generator<string> {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full, predicate);
    } else if (predicate(full)) {
      yield full;
    }
  }
}

describe('Astro + Rozie integration smoke', () => {
  beforeAll(() => {
    execSync('pnpm astro build', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    });
  }, BUILD_TIMEOUT_MS);

  it('produces a dist/ output directory', () => {
    expect(existsSync(ASTRO_OUTPUT)).toBe(true);
  });

  it('rendered HTML contains the <rozie-counter> custom element tag', () => {
    const htmlFiles: string[] = [];
    for (const path of walk(ASTRO_OUTPUT, (p) => p.endsWith('.html'))) {
      htmlFiles.push(readFileSync(path, 'utf8'));
    }
    expect(htmlFiles.length).toBeGreaterThan(0);
    const haystack = htmlFiles.join('\n');
    expect(haystack).toContain('<rozie-counter');
  });

  it('bundle JS contains compiled Rozie/Lit markers', () => {
    const chunks: string[] = [];
    for (const path of walk(ASTRO_OUTPUT, (p) => p.endsWith('.js'))) {
      chunks.push(readFileSync(path, 'utf8'));
    }
    const haystack = chunks.join('\n');
    // Stable Rozie markers — scope-hash attr OR runtime import — that
    // survive Astro/Vite's Rollup-backed production minification.
    expect(haystack).toMatch(/data-rozie-s-|rozieSpread|rozieListeners/);
  });
});

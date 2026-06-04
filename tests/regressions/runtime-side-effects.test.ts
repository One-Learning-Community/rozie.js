import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guard for the `"sideEffects": false` claim on every `@rozie/runtime-*` package.
 *
 * `"sideEffects": false` is a promise to bundlers: "you may drop any module of
 * mine you don't import." If a source file does work at *import* time — registers
 * a global, patches a prototype, side-effect-imports CSS, runs a bare call — the
 * flag becomes a lie, and a bundler can legally tree-shake away code a consumer
 * needed. That is a silent class of bug no typecheck or unit test catches, which
 * is exactly why this packaging invariant gets its own regression guard.
 *
 * This is a HEURISTIC scanner, not a full evaluator. It asserts:
 *   1. every runtime package declares `"sideEffects": false`;
 *   2. no source module has a bare side-effect import (`import './x.css'`);
 *   3. no source module has a module-scope (column-0) executable statement other
 *      than a declaration — the single allowed top-level evaluation is the
 *      `const X = new Set([...])` pure lookup-table pattern, which starts with an
 *      allowed `const` keyword;
 *   4. no Svelte file ships a `<script context="module">` (import-time JS) or a
 *      `<style>` block (CSS that a `sideEffects:false` bundler could drop).
 *
 * Known limits (so a failure is read correctly): the column-0 scan assumes these
 * files stay Biome-formatted (2-space indent; no column-0 continuation of a
 * multi-line template literal). It also cannot see through `const x = impure()` —
 * detecting that a *called* initializer has side effects is left to code review.
 * If a legitimate new pattern trips the heuristic, widen ALLOWED_TOPLEVEL or the
 * lookup-table exemption rather than deleting the test.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = resolve(__dirname, '..', '..', 'packages', 'runtime');

const ALLOWED_TOPLEVEL = new Set([
  'import',
  'export',
  'const',
  'let',
  'var',
  'function',
  'class',
  'async',
  'type',
  'interface',
  'enum',
  'declare',
  'abstract',
]);

function listRuntimePackages(): { name: string; dir: string }[] {
  return readdirSync(RUNTIME_ROOT)
    .map((entry) => join(RUNTIME_ROOT, entry))
    .filter((dir) => statSync(dir).isDirectory())
    .map((dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      return { name: pkg.name as string, dir };
    })
    .filter((p) => p.name?.startsWith('@rozie/runtime-'));
}

function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkSource(full));
    } else if (
      (/\.(ts|svelte)$/.test(entry)) &&
      !/\.(test|spec)\.[tj]sx?$/.test(entry) &&
      !entry.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Returns `file:line — reason` strings for every import-time side effect found. */
function scanFile(file: string, rel: string): string[] {
  const content = readFileSync(file, 'utf8');
  const violations: string[] = [];

  if (file.endsWith('.svelte')) {
    if (/<script[^>]*\bcontext\s*=\s*["']module["']/.test(content) || /<script[^>]*\bmodule\b/.test(content)) {
      violations.push(`${rel} — has a module-level <script> block (runs at import time)`);
    }
    if (/<style[\s>]/.test(content)) {
      violations.push(`${rel} — has a <style> block (a sideEffects:false bundler may drop its CSS)`);
    }
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    const n = i + 1;
    // Bare side-effect import: `import './x.css'` / `import 'polyfill'` (no bindings).
    if (/^\s*import\s+['"]/.test(line)) {
      violations.push(`${rel}:${n} — bare side-effect import`);
      return;
    }
    // Column-0 statement that is not an allowed declaration keyword.
    const m = /^([A-Za-z_$][\w$]*)/.exec(line);
    if (m && !ALLOWED_TOPLEVEL.has(m[1])) {
      violations.push(`${rel}:${n} — module-scope executable statement \`${m[1]}…\``);
    }
  });

  return violations;
}

const packages = listRuntimePackages();

describe('@rozie/runtime-* packages are genuinely side-effect-free', () => {
  it('discovers all five runtime packages', () => {
    // Sanity: the scan is worthless if path resolution silently finds nothing.
    expect(packages.map((p) => p.name).sort()).toEqual([
      '@rozie/runtime-lit',
      '@rozie/runtime-react',
      '@rozie/runtime-solid',
      '@rozie/runtime-svelte',
      '@rozie/runtime-vue',
    ]);
  });

  it.each(packages)('$name declares "sideEffects": false', ({ dir }) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.sideEffects).toBe(false);
  });

  it.each(packages)('$name has no import-time side effects in source', ({ dir }) => {
    const files = walkSource(join(dir, 'src'));
    expect(files.length).toBeGreaterThan(0); // guard against an empty scan
    const violations = files.flatMap((f) => scanFile(f, f.slice(RUNTIME_ROOT.length + 1)));
    // A clean package yields []. On failure, Vitest prints the offending list.
    expect(violations).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Packaging + generated-docs regression guard for `@rozie-ui/*` leaves.
 *
 * Three independent invariants, all found broken in a pre-0.7.5 packaging
 * audit (duplicate Slots rows, mis-named theme-bridge headers, `sideEffects:
 * false` on CSS-shipping leaves) and fixed at the generator, not the output:
 *
 *   (a) No generated leaf README's "## Slots" / "### Slots" table has a
 *       duplicate slot name within that section. The per-family
 *       `scripts/readme.mjs` iterates the compiler's `ir.slots`, which
 *       legitimately repeats a logical slot once per structural template
 *       branch (r-if/r-else duplication, e.g. virtualized vs. non-virtualized
 *       windowing) — the generator must dedupe by identity before rendering.
 *
 *   (b) Every published `themes/*.css` design-token bridge file's example
 *       `import '@rozie-ui/<pkg>/themes/<file>.css';` line names THAT LEAF'S
 *       OWN package. These files are byte-copied from one family-root
 *       canonical source (which hardcodes a `-react` example import) into
 *       all 6 leaves — copied verbatim, only the react leaf's copy is
 *       actually correct.
 *
 *   (c) No leaf that ships CSS (a `themes/*.css` export, or literal `.css`
 *       files under a published top-level dir) declares the bare boolean
 *       `"sideEffects": false` — that tells a bundler it may drop ANY module
 *       of ours the consumer doesn't statically import, including CSS pulled
 *       in via a bare `import '@rozie-ui/x-y/themes/z.css'`.
 *
 * This is a HEURISTIC scanner over committed output, not a compiler test —
 * on failure, fix the emitting generator (`scripts/readme.mjs` /
 * `scripts/codegen.mjs`'s `copyThemes` / the leaf's `package.json`) and
 * regenerate, don't hand-edit the generated file to make the assertion pass.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(__dirname, '..', '..', 'packages', 'ui');
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];

function listFamilies(): string[] {
  return readdirSync(UI_ROOT).filter((entry) => {
    const dir = join(UI_ROOT, entry);
    return statSync(dir).isDirectory() && existsSync(join(dir, 'packages'));
  });
}

const families = listFamilies();

type Leaf = { fam: string; target: string; dir: string; pkg: any };

function listLeaves(): Leaf[] {
  const out: Leaf[] = [];
  for (const fam of families) {
    for (const target of TARGETS) {
      const dir = join(UI_ROOT, fam, 'packages', target);
      const pkgPath = join(dir, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      out.push({ fam, target, dir, pkg });
    }
  }
  return out;
}

const leaves = listLeaves();

// ---------------------------------------------------------------------------
// (a) No duplicate slot name within a single "## Slots" / "### Slots" table.
// ---------------------------------------------------------------------------

/** Returns `["section heading" -> [dup names]]` violation strings for one README. */
function findDuplicateSlotRows(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const violations: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^#{2,4} Slots\s*$/.test(lines[i])) continue;
    const seen = new Map<string, number>();
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,6} /.test(lines[j])) break; // next heading ends this section
      const row = lines[j];
      if (!row.startsWith('|')) continue;
      const cells = row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length < 2) continue;
      const name = cells[0];
      if (name === 'Slot' || /^-+$/.test(name)) continue; // header / separator row
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    for (const [name, count] of seen) {
      if (count > 1) violations.push(`"${lines[i].replace(/^#+\s*/, '')}" section: slot "${name}" x${count}`);
    }
  }
  return violations;
}

describe('generated leaf READMEs have no duplicate Slots rows', () => {
  it.each(leaves)('$fam/$target README has no duplicate slot names', ({ fam, target, dir }) => {
    const readmePath = join(dir, 'README.md');
    if (!existsSync(readmePath)) return; // some leaves ship no README
    const markdown = readFileSync(readmePath, 'utf8');
    const violations = findDuplicateSlotRows(markdown);
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (b) Every leaf's themes/*.css example import names ITS OWN package.
// ---------------------------------------------------------------------------

function listCssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.css'));
}

describe("leaf themes/*.css headers name the leaf's own package", () => {
  it.each(leaves)('$fam/$target themes/*.css import example matches its own package name', ({ fam, target, dir, pkg }) => {
    const themesDir = join(dir, 'src', 'themes');
    const cssFiles = listCssFiles(themesDir);
    if (cssFiles.length === 0) return; // this leaf ships no theme bridges
    const violations: string[] = [];
    const importRe = /@rozie-ui\/[\w-]+\/themes\//g;
    for (const file of cssFiles) {
      const content = readFileSync(join(themesDir, file), 'utf8');
      const matches = content.match(importRe) ?? [];
      for (const m of matches) {
        const expected = `${pkg.name}/themes/`;
        if (m !== expected) violations.push(`${file}: "${m}" (expected "${expected}")`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (c) No CSS-shipping leaf declares the bare boolean `sideEffects: false`.
// ---------------------------------------------------------------------------

function hasPublishedCss(dir: string, pkg: any): boolean {
  const filesField: string[] = pkg.files || [];
  const publishedDirs = filesField.filter((f) => !f.includes('.'));
  const walk = (d: string): boolean => {
    if (!existsSync(d)) return false;
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === '.svelte-kit') continue;
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (walk(full)) return true;
      } else if (entry.endsWith('.css')) {
        return true;
      }
    }
    return false;
  };
  if (publishedDirs.some((top) => walk(join(dir, top)))) return true;
  // Also treat a `./themes/*` (or any `.css`) export as "ships CSS" even if the
  // scan above missed it (e.g. non-standard `files` entries).
  return JSON.stringify(pkg.exports || {}).includes('.css');
}

describe('CSS-shipping leaves never declare sideEffects: false', () => {
  it.each(leaves)('$fam/$target sideEffects is not the bare boolean false when it ships CSS', ({ fam, target, dir, pkg }) => {
    if (pkg.sideEffects !== false) return; // array / undefined — not this bug shape
    const shipsCss = hasPublishedCss(dir, pkg);
    expect(shipsCss).toBe(false);
  });
});

/**
 * (d) Every relative `.css` import a React leaf's source (and built dist)
 * keeps must resolve to a file that ships in `dist/`.
 *
 * tsdown leaves `import './X.css'` verbatim (the leaf marks `/\.css$/`
 * external), so the file must be `copy`'d into `dist/`. data-table 0.9.1,
 * chartjs and codemirror each imported a CSS file the `copy` list omitted
 * (`GroupBar.css`, `Chart.global.css`, `CodeMirror.global.css`): a consumer's
 * bundler failed to resolve it. Fix the leaf's `tsdown.config.ts` `copy` list.
 */
describe('React leaves ship every relative css import in dist', () => {
  const CSS_IMPORT = /import\s+['"]\.\/([A-Za-z0-9_.-]+\.css)['"]/g;
  const reactLeaves = listLeaves().filter((l) => l.target === 'react');

  function cssImportsIn(files: string[]): Set<string> {
    const out = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(CSS_IMPORT)) out.add(m[1]);
    }
    return out;
  }

  it('finds React leaves to check', () => {
    expect(reactLeaves.length).toBeGreaterThan(20);
  });

  for (const leaf of reactLeaves) {
    const cfgPath = join(leaf.dir, 'tsdown.config.ts');
    const srcDir = join(leaf.dir, 'src');
    if (!existsSync(cfgPath) || !existsSync(srcDir)) continue;

    it(`${leaf.fam}-react: tsdown copy list covers every css imported by src`, () => {
      const srcFiles = readdirSync(srcDir)
        .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
        .map((f) => join(srcDir, f));
      const cfg = readFileSync(cfgPath, 'utf8');
      const missing = [...cssImportsIn(srcFiles)].filter(
        (css) => !cfg.includes(`'src/${css}'`) && !cfg.includes(`"src/${css}"`),
      );
      expect(missing, `css imported by src but not in tsdown copy: ${missing.join(', ')}`).toEqual([]);
    });

    it(`${leaf.fam}-react: every css specifier in built dist resolves inside dist`, () => {
      const distDir = join(leaf.dir, 'dist');
      if (!existsSync(distDir)) return; // unbuilt checkout: source-level check above still guards
      const distFiles = readdirSync(distDir)
        .filter((f) => f.endsWith('.mjs') || f.endsWith('.cjs'))
        .map((f) => join(distDir, f));
      const CJS_REQ = /require\(['"]\.\/([A-Za-z0-9_.-]+\.css)['"]\)/g;
      const missing: string[] = [];
      for (const f of distFiles) {
        const text = readFileSync(f, 'utf8');
        const specs = [...text.matchAll(CSS_IMPORT), ...text.matchAll(CJS_REQ)].map((m) => m[1]);
        for (const css of specs) if (!existsSync(join(distDir, css))) missing.push(`${css} (from ${f})`);
      }
      expect(missing).toEqual([]);
    });
  }
});

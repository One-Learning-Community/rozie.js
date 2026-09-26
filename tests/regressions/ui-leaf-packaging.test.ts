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

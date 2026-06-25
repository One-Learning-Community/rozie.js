/**
 * surface-hash.mjs — the SINGLE source of truth for the comparison-page staleness
 * guard.
 *
 * A `docs/components/<slug>-comparison.md` page hand-asserts capability claims about
 * `@rozie-ui/<slug>` (range support, two-way binding, headless slots, imperative
 * handle, …). Unlike the codegen-validated `### Props` table in `<slug>.md`, that
 * prose is protected by NOTHING — Phase 62 shipped date-picker range selection while
 * the comparison page silently kept claiming "single-date only" (fixed 048aa120).
 *
 * This util extracts a family's compiled public surface (props / model props / emits /
 * slots / `$expose` verbs) over the SAME `@rozie/core` primitive the surface gates and
 * codegen already use (`parse` + `lowerToIR`), hashes it deterministically, and lets
 * the vitest drift gate compare that hash against a `surface_hash:` marker recorded in
 * the page's frontmatter. When the surface drifts, the marker no longer matches and a
 * human is FORCED to re-read the comparison page and confirm it's still accurate.
 *
 * Reused by both the test (`tests/comparison-surface.test.ts`) and the one-shot seeding
 * step (run this file directly: `node scripts/surface-hash.mjs`).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse, lowerToIR, createDefaultRegistry } from '@rozie/core';

// Repo layout: docs/scripts/surface-hash.mjs → repo root is two dirs up.
const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const COMPONENTS_DIR = resolve(import.meta.dirname, '..', 'components');
const UI_ROOT = resolve(REPO_ROOT, 'packages', 'ui');

// Slug→dir is 1:1 EXCEPT this single exception. Everything else uses the slug verbatim.
export const SLUG_TO_DIR = { sortable: 'sortable-list' };

export function familyDirForSlug(slug) {
  return SLUG_TO_DIR[slug] ?? slug;
}

/** All comparison-page slugs (basename minus `-comparison.md`), sorted. */
export function listComparisonSlugs() {
  return readdirSync(COMPONENTS_DIR)
    .filter((f) => f.endsWith('-comparison.md'))
    .map((f) => f.slice(0, -'-comparison.md'.length))
    .sort();
}

/** Absolute path to a comparison page. */
export function comparisonPagePath(slug) {
  return resolve(COMPONENTS_DIR, `${slug}-comparison.md`);
}

const uniqSorted = (arr) => [...new Set(arr)].sort();

/**
 * Compute the deterministic 12-hex-char surface hash for a family slug.
 * Returns `null` when the mapped `packages/ui/<dir>/src` has no `.rozie` source
 * (signals "skip — no family package", never a false failure).
 *
 * Throws if any `.rozie` source produces an error-severity lowering diagnostic — a
 * broken source must NOT silently yield a stable hash.
 */
export function computeSurfaceHash(slug) {
  const dir = familyDirForSlug(slug);
  const srcDir = resolve(UI_ROOT, dir, 'src');
  if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) return null;

  const rozieFiles = readdirSync(srcDir)
    .filter((f) => f.endsWith('.rozie'))
    .map((f) => resolve(srcDir, f))
    .sort();
  if (rozieFiles.length === 0) return null;

  const props = [];
  const models = [];
  const emits = [];
  const slots = [];
  const expose = [];

  for (const file of rozieFiles) {
    const source = readFileSync(file, 'utf8');
    // Pass the ABSOLUTE host path to BOTH parse() and lowerToIR() so the
    // `.rzts`/`.rzjs` script-partial inline pass (inside lowerToIR) can resolve sibling
    // partials relative to src/ — e.g. data-table's DataTable.rozie imports ~20
    // sibling `.rzts` partials. The IR scope hash uses BASENAME only, so absolute vs
    // relative is surface-identical (mirrors packages/ui/data-table/scripts/codegen.mjs).
    const { ast } = parse(source, { filename: file });
    const { ir, diagnostics = [] } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
      filename: file,
    });
    const errs = diagnostics.filter((d) => d.severity === 'error');
    if (errs.length) {
      throw new Error(
        `surface-hash: ${slug} (${filename}) lowerToIR errors: ${errs
          .map((d) => `${d.code} ${d.message}`)
          .join('; ')}`,
      );
    }
    for (const p of ir.props ?? []) {
      props.push(p.name);
      if (p.isModel) models.push(p.name);
    }
    for (const e of ir.emits ?? []) emits.push(e);
    for (const s of ir.slots ?? []) slots.push(s.name);
    for (const e of ir.expose ?? []) expose.push(e.name);
  }

  const surface = {
    props: uniqSorted(props),
    models: uniqSorted(models),
    emits: uniqSorted(emits),
    slots: uniqSorted(slots),
    expose: uniqSorted(expose),
  };

  return createHash('sha256')
    .update(JSON.stringify(surface))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Read the `surface_hash:` value from a comparison page's leading YAML frontmatter.
 * Returns the trimmed string, or `null` if there is no frontmatter block or no marker.
 * Simple line scan between the leading `---` fences — no YAML dep.
 */
export function readSurfaceMarker(slug) {
  const path = comparisonPagePath(slug);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  if (!text.startsWith('---')) return null;
  const lines = text.split(/\r?\n/);
  // lines[0] is the opening '---'; scan until the closing fence.
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') break;
    const m = /^surface_hash:\s*(\S+)\s*$/.exec(lines[i]);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Write `surface_hash: <hash>` into a comparison page's frontmatter, inserting a
 * frontmatter block if the page has none. Idempotent: replaces an existing marker.
 * Returns the new file text (does NOT write to disk — caller persists).
 */
export function withSurfaceMarker(text, hash) {
  const markerLine = `surface_hash: ${hash}`;
  if (text.startsWith('---')) {
    const lines = text.split('\n');
    // Find closing fence.
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        close = i;
        break;
      }
    }
    if (close === -1) {
      // Malformed frontmatter — fall through to prepend a fresh block.
    } else {
      // Replace existing marker if present, else insert before closing fence.
      for (let i = 1; i < close; i++) {
        if (/^surface_hash:\s*/.test(lines[i])) {
          lines[i] = markerLine;
          return lines.join('\n');
        }
      }
      lines.splice(close, 0, markerLine);
      return lines.join('\n');
    }
  }
  // No frontmatter — prepend a fresh block.
  return `---\n${markerLine}\n---\n\n${text}`;
}

// ── one-shot seeding / inspection: `node scripts/surface-hash.mjs [--write] ──────
if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes('--write');
  const { writeFileSync } = await import('node:fs');
  for (const slug of listComparisonSlugs()) {
    const hash = computeSurfaceHash(slug);
    if (hash === null) {
      console.log(`${slug}\tSKIP (no family package)`);
      continue;
    }
    const current = readSurfaceMarker(slug);
    const status = current === hash ? 'ok' : current == null ? 'MISSING' : 'DRIFT';
    console.log(`${slug}\t${hash}\t${status}`);
    if (write && current !== hash) {
      const path = comparisonPagePath(slug);
      const next = withSurfaceMarker(readFileSync(path, 'utf8'), hash);
      writeFileSync(path, next);
    }
  }
}

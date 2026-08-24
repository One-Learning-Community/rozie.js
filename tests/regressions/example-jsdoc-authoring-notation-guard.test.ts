/**
 * example-jsdoc-authoring-notation-guard.test.ts — Phase 81 Plan 04 (R5/R6).
 *
 * Standing regression guard: no emitted `@rozie-ui` leaf source may carry
 * `.rozie` AUTHORING notation inside a rendered `@example` JSDoc block. Once
 * Plan 01's `renderExampleMarkup` + Plan 03's ROZ097 pre-emit validator
 * landed, every COMPILED example is supposed to already be target-correct
 * consumer markup — this guard is the automated proof that stays true,
 * walking every committed leaf source and dist-parity fixture rather than
 * trusting a one-time audit (this plan's own corpus census, verified against
 * 81-03's independent count).
 *
 * RED BY DESIGN at landing time (2026-08-24): the repo's `packages/ui/**`
 * leaves have NOT been regenerated yet under the Plan 01/03 renderer +
 * diagnostic — that regeneration is Plan 05's forced build. Until then the
 * third describe block below is EXPECTED to fail; see 81-04-SUMMARY.md for
 * the exact violation count recorded at landing and the command that turns
 * it green. Do NOT hand-edit a generated leaf to make this pass — the
 * emitter owns parity (T-81-11).
 *
 * Two halves:
 *  - a PURE scanner (`findAuthoringNotation`) + example-body extractor
 *    (`extractExampleBodies`), unit-proven in both directions with ZERO
 *    file-system access (the `scanner` / `extractor` describe blocks below)
 *    — these pass today and stay green forever;
 *  - a repo walk (`emitted output carries no authoring notation`) that
 *    applies the scanner to every real committed leaf/fixture file — RED
 *    today, the count Plan 05's regeneration must drive to zero.
 *
 * The walk enumerates families DYNAMICALLY (`readdirSync` over
 * `packages/ui/<family>/packages/<target>/src`) rather than from a
 * hard-coded array — deliberately NOT mirroring the closest in-repo
 * precedent, `tests/strict-conformance/family-strict-conformance.test.ts`'s
 * hard-coded `FAMILIES` array (planner ruling 2): a family added after this
 * phase is covered automatically. Zero new dependencies — `node:fs` /
 * `node:path` only (planner ruling 3), matching this package's undeclared
 * glob dependency.
 *
 * Two patterns are checked on every surface (Vue included); two are checked
 * on non-Vue surfaces only (planner ruling 5) — see the per-pattern comments
 * below for why.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// tests/regressions -> repo root (mirrors tests/strict-conformance/
// strict-conformance.harness.ts's ROOT resolution).
const ROOT = join(HERE, '..', '..');

// ── the four forbidden authoring-notation shapes ──────────────────────────

/**
 * `r-model:` — the `r-`-prefixed model directive keyword followed by its
 * colon. Checked on EVERY surface: after this phase the renderer rewrites
 * this even on Vue (into `v-model:`), so a Vue hit is a real regression too,
 * not a false positive.
 */
const MODEL_DIRECTIVE_RE = /\br-model:/;

/**
 * `<template #` — the slot-fill shape. Checked on EVERY surface: a slot fill
 * is hard-rejected by ROZ097, so no surface can legitimately carry one.
 */
const SLOT_FILL_RE = /<template\s+#/;

/**
 * A colon-prefixed binding attribute (`:foo="bar"`), anchored on the double
 * quote. Checked on non-Vue surfaces ONLY — `:foo="bar"` is Vue's own
 * legitimate binding syntax and stays on every Vue leaf by design.
 */
const COLON_ATTR_RE = /\s:[A-Za-z][\w-]*="/;

/**
 * An at-prefixed event attribute (`@foo="bar"`), anchored on the double
 * quote. Checked on non-Vue surfaces ONLY. The double-quote anchor is
 * load-bearing: Lit's legitimate `@foo=${...}` change listener has a
 * template-literal substitution value, not a double-quoted string, so it
 * does NOT match this pattern — without the anchor this would also
 * false-positive on every Lit leaf's real event bindings.
 */
const AT_ATTR_RE = /\s@[A-Za-z][\w-]*="/;

/**
 * Scan a single rendered `@example` body for authoring-notation shapes.
 * PURE — no file-system access, never throws. Returns one short violation
 * name per pattern matched (fixed order); empty when the body is clean.
 */
export function findAuthoringNotation(exampleBody: string, isVueSurface: boolean): string[] {
  const violations: string[] = [];
  if (MODEL_DIRECTIVE_RE.test(exampleBody)) violations.push('r-model-directive');
  if (SLOT_FILL_RE.test(exampleBody)) violations.push('slot-fill');
  if (!isVueSurface) {
    if (COLON_ATTR_RE.test(exampleBody)) violations.push('colon-prefixed-attribute');
    if (AT_ATTR_RE.test(exampleBody)) violations.push('at-prefixed-attribute');
  }
  return violations;
}

/**
 * Whether `filePath` is a Vue surface: its path carries a `vue` path segment
 * directly under a `packages` segment, or its name ends in the Vue
 * single-file-component extension. Every other file is non-Vue. Normalizes
 * separators first so the check is platform-independent.
 */
function isVueSurface(filePath: string): boolean {
  if (filePath.endsWith('.vue')) return true;
  const normalized = filePath.replace(/\\/g, '/');
  return /\/packages\/vue\//.test(normalized);
}

/**
 * Extract every rendered `@example` JSDoc body from `text` (a whole file's
 * source). Locates each `@example` tag line inside a block comment, then
 * collects the following comment lines — leading star and single space
 * stripped — until a line that opens another `@`-tag or closes the block.
 * Each collected run is returned newline-joined, one string per `@example`
 * tag found; a file with no `@example` tags returns an empty array.
 */
export function extractExampleBodies(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const bodies: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\*\s*@example\s*$/.test(lines[i])) continue;
    const collected: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const line = lines[j];
      if (/^\s*\*\/\s*$/.test(line)) break; // block close
      if (/^\s*\*\s*@\w/.test(line)) break; // next tag — do not swallow it
      collected.push(line.replace(/^\s*\*\s?/, ''));
    }
    bodies.push(collected.join('\n'));
    i = j - 1;
  }
  return bodies;
}

// ── repo walk ───────────────────────────────────────────────────────────

const SOURCE_EXT_RE = /\.(ts|tsx|vue|svelte)$/;

/** Recursive `readdirSync` walk collecting source files into `files`, skipping `node_modules`/`dist`. Standard-library only (planner ruling 3). */
function collectSourceFiles(root: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, files);
    } else if (SOURCE_EXT_RE.test(entry.name)) {
      files.push(full);
    }
  }
}

/**
 * The two committed emitted-output roots this guard walks: every `src`
 * directory found at `packages/ui/<family>/packages/<target>/`, discovered
 * by reading the family and target directory listings (NOT a hard-coded
 * family list — planner ruling 2), plus `tests/dist-parity/fixtures`.
 */
function findRoots(root: string): string[] {
  const roots: string[] = [];
  const uiDir = join(root, 'packages', 'ui');
  for (const familyEntry of readdirSync(uiDir, { withFileTypes: true })) {
    if (!familyEntry.isDirectory()) continue;
    const packagesDir = join(uiDir, familyEntry.name, 'packages');
    if (!existsSync(packagesDir) || !statSync(packagesDir).isDirectory()) continue;
    for (const targetEntry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!targetEntry.isDirectory()) continue;
      const srcDir = join(packagesDir, targetEntry.name, 'src');
      if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
        roots.push(srcDir);
      }
    }
  }
  roots.push(join(root, 'tests', 'dist-parity', 'fixtures'));
  return roots;
}

// ── scanner (pure, zero file-system access) ────────────────────────────

describe('findAuthoringNotation scanner', () => {
  it('scanner flags the authoring two-way directive on every surface, Vue included', () => {
    const body = '<FlowCanvas r-model:graph="graph" />';
    expect(findAuthoringNotation(body, false)).toContain('r-model-directive');
    expect(findAuthoringNotation(body, true)).toContain('r-model-directive');
  });

  it('scanner flags the slot-fill shape on every surface, Vue included', () => {
    const body = '<template #body="{ node }">{{ node.data.label }}</template>';
    expect(findAuthoringNotation(body, false)).toContain('slot-fill');
    expect(findAuthoringNotation(body, true)).toContain('slot-fill');
  });

  it('scanner flags a colon-prefixed double-quoted attribute on a non-Vue surface, and NOT on a Vue surface', () => {
    const body = '<FlowCanvas :validate-types="true" />';
    expect(findAuthoringNotation(body, false)).toContain('colon-prefixed-attribute');
    expect(findAuthoringNotation(body, true)).not.toContain('colon-prefixed-attribute');
  });

  it('scanner flags an at-prefixed double-quoted attribute on a non-Vue surface, and NOT on a Vue surface', () => {
    const body = '<FlowCanvas @node-moved="onMoved" />';
    expect(findAuthoringNotation(body, false)).toContain('at-prefixed-attribute');
    expect(findAuthoringNotation(body, true)).not.toContain('at-prefixed-attribute');
  });

  it("scanner reports no violation for any of the six blessed kitchen-sink goldens on its own surface, including Lit's at-prefixed change listener and Angular's parenthesised output", () => {
    // Derived byte-for-byte from packages/core/src/__tests__/render-example-markup.test.ts's
    // Block C KITCHEN_SINK goldens (Phase 81 Plan 01) — the must-not-flag cases.
    const vueGolden =
      '<FlowCanvas label="Save" v-model:graph="graph" id="flow" :validate-types="true" @node-moved="onMoved" readonly><Port output="num" type="number" /></FlowCanvas>';
    const reactGolden =
      '<FlowCanvas label="Save" graph={graph} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>';
    const solidGolden =
      '<FlowCanvas label="Save" graph={graph()} onGraphChange={setGraph} id="flow" validateTypes={true} onNodeMoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>';
    const svelteGolden =
      '<FlowCanvas label="Save" bind:graph id="flow" validateTypes={true} onnodemoved={onMoved} readonly><Port output="num" type="number" /></FlowCanvas>';
    const angularGolden =
      '<rozie-flow-canvas label="Save" [(graph)]="graph" id="flow" [validateTypes]="true" (node-moved)="onMoved" readonly><rozie-port output="num" type="number" /></rozie-flow-canvas>';
    const litGolden =
      '<rozie-flow-canvas label="Save" .graph=${graph} @graph-change=${…} id="flow" .validateTypes=${true} @node-moved=${onMoved} readonly><rozie-port output="num" type="number"></rozie-port></rozie-flow-canvas>';

    expect(findAuthoringNotation(vueGolden, true)).toEqual([]);
    expect(findAuthoringNotation(reactGolden, false)).toEqual([]);
    expect(findAuthoringNotation(solidGolden, false)).toEqual([]);
    expect(findAuthoringNotation(svelteGolden, false)).toEqual([]);
    expect(findAuthoringNotation(angularGolden, false)).toEqual([]);
    expect(findAuthoringNotation(litGolden, false)).toEqual([]);
  });
});

// ── extractor (pure, zero file-system access) ──────────────────────────

describe('extractExampleBodies extractor', () => {
  it('extractor collects a single example tag followed by two continuation lines', () => {
    const text = [
      '/**',
      ' * Some description.',
      ' * @example',
      ' * <Foo bar="1" />',
      ' * second line',
      ' */',
    ].join('\n');
    expect(extractExampleBodies(text)).toEqual(['<Foo bar="1" />\nsecond line']);
  });

  it('extractor stops at the next tag and does not swallow its text into the body', () => {
    const text = [
      '/**',
      ' * @example',
      ' * <Foo bar="1" />',
      ' * @deprecated use something else instead',
      ' */',
    ].join('\n');
    const bodies = extractExampleBodies(text);
    expect(bodies).toEqual(['<Foo bar="1" />']);
    expect(bodies[0]).not.toContain('deprecated');
  });
});

// ── the standing guard: repo walk (RED BY DESIGN until Plan 05) ────────

describe('emitted output carries no authoring notation', () => {
  const files: string[] = [];
  for (const root of findRoots(ROOT)) {
    collectSourceFiles(root, files);
  }

  interface Violation {
    file: string;
    kinds: string[];
  }
  const violations: Violation[] = [];
  let exampleCount = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const bodies = extractExampleBodies(text);
    exampleCount += bodies.length;
    const vueSurface = isVueSurface(file);
    for (const body of bodies) {
      const kinds = findAuthoringNotation(body, vueSurface);
      if (kinds.length > 0) violations.push({ file, kinds });
    }
  }

  // Assert the walk actually walked something BEFORE asserting zero
  // violations — a mis-rooted or empty walk must fail loudly instead of
  // passing vacuously (T-81-12).
  it('scans a non-zero number of files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('extracts a non-zero number of example bodies', () => {
    expect(exampleCount).toBeGreaterThan(0);
  });

  it('carries zero authoring-notation violations in any emitted @example block', () => {
    if (violations.length === 0) return;

    const PREVIEW_LIMIT = 15;
    const preview = violations
      .slice(0, PREVIEW_LIMIT)
      .map((v) => `  ${v.file}: ${v.kinds.join(', ')}`)
      .join('\n');
    const affectedFiles = new Set(violations.map((v) => v.file)).size;
    const remaining = violations.length - Math.min(PREVIEW_LIMIT, violations.length);
    const tail = remaining > 0 ? `\n  ...and ${remaining} more` : '';

    // RED BY DESIGN (Phase 81 Plan 04) until Plan 05's forced build
    // regenerates every leaf under the Plan 01/03 renderer + diagnostic —
    // this failure IS the plan working correctly. See 81-04-SUMMARY.md for
    // the count recorded at landing and the command that clears it to zero.
    throw new Error(
      `${violations.length} authoring-notation violation(s) across ${affectedFiles} file(s) ` +
        `— RED BY DESIGN, Plan 05's forced build must drive this to zero:\n${preview}${tail}`,
    );
  });
});

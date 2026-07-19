/**
 * starterKitCollisions.test.ts — drift guard for the `STARTERKIT_COLLISION_MAP`
 * hardcoded in TipTap.rozie (ask A, quick 260719-cqb).
 *
 * The component auto-disables a StarterKit-bundled node/mark option key when
 * the consumer supplies a same-named custom extension via `extensions` (and
 * has not already decided that key's fate via `starterKit`). The set of keys
 * it knows how to disable is a hardcoded map, independent of the installed
 * `@tiptap/starter-kit` package. If a future StarterKit bump adds or removes
 * a configurable node/mark, that hardcoded map can silently drift out of sync
 * — this test fails loudly when that happens, forcing a conscious update.
 *
 * Two independent extractions, asserted to agree:
 *   A) SOURCE side  — the VALUE set of `STARTERKIT_COLLISION_MAP` parsed out
 *      of TipTap.rozie as plain text.
 *   B) STARTERKIT side — every member key of the installed
 *      `@tiptap/starter-kit` dist `interface StarterKitOptions { ... }`,
 *      minus the structural/plumbing keys that are not node/mark
 *      replacements (document, text, dropcursor, gapcursor, listKeymap,
 *      trailingNode).
 *
 * Hermetic: pure fs + text extraction. No editor instantiation, no DOM.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(HERE, '..', 'src', 'TipTap.rozie');
const source = readFileSync(SRC_PATH, 'utf8');

// StarterKit's structural/plumbing option keys — not node/mark replacements,
// intentionally NOT in the component's collision map (locked list, PLAN.md).
const STRUCTURAL_EXCLUSIONS = new Set([
  'document',
  'text',
  'dropcursor',
  'gapcursor',
  'listKeymap',
  'trailingNode',
]);

// The 15 locked node/mark collision keys (PLAN.md Task 2, second assertion).
const LOCKED_NODE_MARK_KEYS = [
  'bold',
  'italic',
  'strike',
  'code',
  'heading',
  'paragraph',
  'blockquote',
  'codeBlock',
  'hardBreak',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'listItem',
  'link',
  'underline',
];

/**
 * Extract a balanced-brace `{ ... }` object-literal body that begins right
 * after `marker` in `text`. Returns the substring between the opening brace
 * (exclusive, already consumed by `marker` ending in `{`) and its matching
 * closing brace.
 */
function extractBalancedBody(text: string, marker: string, label: string): string {
  const startIdx = text.indexOf(marker);
  if (startIdx === -1) throw new Error(`${label} not found (marker: ${marker})`);
  const bodyStart = startIdx + marker.length;
  let depth = 1;
  let i = bodyStart;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`${label}: unbalanced braces starting at marker`);
  return text.slice(bodyStart, i);
}

/** A) SOURCE side — the VALUE set of `STARTERKIT_COLLISION_MAP` in TipTap.rozie. */
function extractCollisionMapValues(rozieSource: string): string[] {
  const body = extractBalancedBody(
    rozieSource,
    'const STARTERKIT_COLLISION_MAP = {',
    'STARTERKIT_COLLISION_MAP',
  );
  const values = [...body.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
  if (values.length === 0) {
    throw new Error('STARTERKIT_COLLISION_MAP body parsed but yielded zero values — check the map shape');
  }
  return values;
}

/**
 * Resolve the installed `@tiptap/starter-kit`'s `dist/index.d.ts`. Prefers
 * Node module resolution (works through pnpm's per-package `node_modules`
 * symlink into the content-addressed store); falls back to a direct glob
 * under the monorepo-root `node_modules/.pnpm` store in case resolution from
 * this test file's location differs from the package's own resolution roots.
 */
function resolveStarterKitDts(): string {
  try {
    const require = createRequire(import.meta.url);
    const mainEntry = require.resolve('@tiptap/starter-kit');
    const dtsPath = join(dirname(mainEntry), 'index.d.ts');
    if (existsSync(dtsPath)) return dtsPath;
  } catch {
    // fall through to the pnpm-store glob fallback below
  }

  const repoRoot = resolve(HERE, '..', '..', '..', '..');
  const pnpmDir = join(repoRoot, 'node_modules', '.pnpm');
  const entries = existsSync(pnpmDir) ? readdirSync(pnpmDir) : [];
  const match = entries.find((e) => e.startsWith('@tiptap+starter-kit@'));
  if (!match) {
    throw new Error(
      'Could not resolve @tiptap/starter-kit — neither Node resolution nor the ' +
        `node_modules/.pnpm glob fallback found it (looked under ${pnpmDir})`,
    );
  }
  const dtsPath = join(pnpmDir, match, 'node_modules', '@tiptap', 'starter-kit', 'dist', 'index.d.ts');
  if (!existsSync(dtsPath)) {
    throw new Error(`Resolved pnpm store dir (${match}) but dist/index.d.ts is missing at ${dtsPath}`);
  }
  return dtsPath;
}

/** B) STARTERKIT side — every member key of `interface StarterKitOptions { ... }`. */
function extractStarterKitOptionsKeys(dtsSource: string): string[] {
  const body = extractBalancedBody(dtsSource, 'interface StarterKitOptions {', 'StarterKitOptions');
  // Each member sits at the start of its own (indented) line, immediately
  // followed by `:`. JSDoc comment lines (`/** ... */`, `* ...`, `* @example
  // key: value`) never start a line with a bare identifier, so they don't
  // false-match here.
  const keys = [...body.matchAll(/\n[ \t]*([A-Za-z_$][\w$]*)[ \t]*:/g)].map((m) => m[1]);
  const unique = [...new Set(keys)];
  if (unique.length === 0) {
    throw new Error('interface StarterKitOptions parsed but yielded zero member keys — check dist d.ts shape');
  }
  return unique;
}

describe('TipTap StarterKit collision-key drift guard', () => {
  const dtsPath = resolveStarterKitDts();
  const dtsSource = readFileSync(dtsPath, 'utf8');
  const allOptionKeys = extractStarterKitOptionsKeys(dtsSource);

  // Node/mark-configurable subset = all StarterKitOptions keys minus the
  // structural-exclusion set minus `undoRedo` (handled separately below),
  // then `undoRedo` is re-added explicitly — it IS user-facing (via the
  // history/undoRedo name) even though it isn't one of the 15 "plain"
  // node/mark keys. Net effect: structural exclusions are the only keys
  // actually dropped; `undoRedo` round-trips back in either way.
  const nodeMarkKeysMinusUndoRedo = allOptionKeys.filter(
    (key) => !STRUCTURAL_EXCLUSIONS.has(key) && key !== 'undoRedo',
  );
  const expectedNodeMarkKeys = [...nodeMarkKeysMinusUndoRedo, 'undoRedo'];

  const sourceValues = extractCollisionMapValues(source);

  it('binds the component collision-map value set to the installed StarterKitOptions node/mark keys', () => {
    const sortedSource = [...new Set(sourceValues)].sort();
    const sortedExpected = [...new Set(expectedNodeMarkKeys)].sort();
    // A StarterKit bump introducing a brand-new configurable node/mark shows
    // up in `allOptionKeys` (and therefore `expectedNodeMarkKeys`, since it's
    // not in the structural-exclusion set) but NOT in the component's
    // hardcoded map — the sets diverge and this assertion fails, forcing a
    // conscious decision about the new key.
    expect(sortedSource).toEqual(sortedExpected);
  });

  it('includes every locked node/mark key as a collision-map value', () => {
    // Cheaper, independent-of-StarterKit assertion: catches a hand-edit that
    // removes one of the 15 locked keys even if StarterKit itself hasn't
    // changed.
    for (const key of LOCKED_NODE_MARK_KEYS) {
      expect(sourceValues).toContain(key);
    }
  });
});

/**
 * action-menu-clamp.test.ts — six-leaf structural gate for quick task
 * 260903-0s1's CP-08 fix: the action-menu flyout's viewport clamp (inside
 * `openActionMenu()`'s rAF callback) must compare against a freshly-hoisted
 * plain local (`anchorTop`), never a re-read of the target's own reactive
 * offset holder.
 *
 * WHY this matters: on React, a `$data` read lowers to the value the
 * enclosing render closure captured — a read deferred past the current
 * render (rAF, setTimeout, a promise continuation) observes the PRE-write
 * value. `openActionMenu()`'s rAF callback re-reads `actionMenuTop` — the
 * SAME state the function itself just set moments earlier, synchronously,
 * before scheduling the rAF — so on a session's first open the comparison is
 * against the stale initial `0` and the clamp never applies. The other five
 * targets read a live holder (`.value`, a signal call, a rune) and are
 * correct-by-construction; this gate holds all six to the SAME hoisted-local
 * shape so none of them stay correct only by accident of their reactivity
 * model.
 *
 * STATING THE LIMIT HONESTLY: there is no React mount harness in this
 * package (no `react`/`react-dom`/a react vite plugin devDependency), so this
 * gate proves CP-08 at the emitted-leaf-SOURCE level — a structural read of
 * the compiled `.tsx`/`.vue`/`.svelte`/`.ts` text — not by driving a real
 * React render and measuring a genuinely-clamped DOM position. Adding a React
 * mount harness to this package is real, useful follow-up work; it is
 * recorded here as backlog, not silently dropped.
 *
 * Mirrors combobox's tests/prohibitions.test.ts / leaf-source-contracts.test.ts
 * reader idiom: read the SIX emitted `CommandPalette.<ext>` leaves as plain
 * source text, no compile, no mount. Each gate is a pure
 * `check(source) -> violations[]` function, driven against a
 * deliberately-mutated NEGATIVE fixture to prove it actually fires.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const TARGETS = [
  { name: 'react', ext: 'tsx' },
  { name: 'vue', ext: 'vue' },
  { name: 'svelte', ext: 'svelte' },
  { name: 'angular', ext: 'ts' },
  { name: 'solid', ext: 'tsx' },
  { name: 'lit', ext: 'ts' },
] as const;

type TargetName = (typeof TARGETS)[number]['name'];

interface LeafSource {
  id: TargetName;
  source: string;
}

function readLeaf(name: TargetName, ext: string): LeafSource {
  const path = resolve(ROOT, 'packages', name, 'src', `CommandPalette.${ext}`);
  return { id: name, source: readFileSync(path, 'utf8') };
}

const leaves: LeafSource[] = TARGETS.map(({ name, ext }) => readLeaf(name, ext));

// The clamp's `if (<comparison> > maxTop) <write>;` — `maxTop` is a plain
// local scoped entirely inside `openActionMenu()`'s rAF callback and used
// nowhere else in the file, so its ONE occurrence anchors the slice.
//
// Deliberately NOT a single forward regex from position 0: `maxTop` is
// unique, but `if (` is not — a lazy `[\s\S]*?` quantifier searching for
// `if (...> maxTop)` from the start of the file matches the FIRST `if (` in
// the ENTIRE FILE (an unrelated one, often hundreds of lines earlier) and
// happily consumes everything up to the one `maxTop` occurrence, capturing
// nearly the whole file as "the condition". Anchoring on the `maxTop`
// occurrence FIRST and searching backward within a bounded window for the
// nearest `if (` is what keeps this local to the actual clamp.
const MAXTOP_ANCHOR = '> maxTop)';
const IF_TOKEN = 'if (';
const BACKWARD_WINDOW = 300;

interface ClampExtraction {
  conditionExpr: string;
  writeStmt: string;
}

function extractClamp(source: string): ClampExtraction | null {
  const anchorIdx = source.indexOf(MAXTOP_ANCHOR);
  if (anchorIdx === -1) return null;

  const windowStart = Math.max(0, anchorIdx - BACKWARD_WINDOW);
  const backwardWindow = source.slice(windowStart, anchorIdx);
  const ifIdxInWindow = backwardWindow.lastIndexOf(IF_TOKEN);
  if (ifIdxInWindow === -1) return null;
  const conditionStart = windowStart + ifIdxInWindow + IF_TOKEN.length;
  const conditionExpr = source.slice(conditionStart, anchorIdx).trim();

  const afterAnchorIdx = anchorIdx + MAXTOP_ANCHOR.length;
  const semiIdx = source.indexOf(';', afterAnchorIdx);
  if (semiIdx === -1) return null;
  const writeStmt = source
    .slice(afterAnchorIdx, semiIdx)
    .trim()
    .replace(/^\{\s*/, '')
    .trim();

  return { conditionExpr, writeStmt };
}

// The six targets' reactive-HOLDER read spellings — what the comparison must
// NOT read after the fix. React's bare `actionMenuTop` is the actual CP-08
// defect; the other five are correct-but-fragile (they happen to read a live
// holder), and this gate standardizes all six onto the same hoisted-local
// shape regardless.
const HOLDER_READ_PATTERNS: Record<TargetName, RegExp> = {
  react: /^actionMenuTop$/,
  svelte: /^actionMenuTop$/,
  vue: /^actionMenuTop\.value$/,
  solid: /^actionMenuTop\(\)$/,
  lit: /^this\._actionMenuTop\.value$/,
  angular: /^this\.actionMenuTop\(\)$/,
};

// The six targets' NORMAL reactive-write shapes on the clamped branch — must
// still be present (C3): the fix hoists the COMPARISON to a local, it must
// NOT demote the holder the template depends on for the `:style` top binding.
const EXPECTED_WRITE_PATTERNS: Record<TargetName, RegExp> = {
  react: /^setActionMenuTop\(maxTop\)$/,
  svelte: /^actionMenuTop\s*=\s*maxTop$/,
  vue: /^actionMenuTop\.value\s*=\s*maxTop$/,
  solid: /^setActionMenuTop\(maxTop\)$/,
  lit: /^this\._actionMenuTop\.value\s*=\s*maxTop$/,
  angular: /^this\.actionMenuTop\.set\(maxTop\)$/,
};

const HOISTED_LOCAL_NAME = 'anchorTop';

function checkClampContract(source: string, targetName: TargetName): string[] {
  const violations: string[] = [];
  const extracted = extractClamp(source);
  if (extracted === null) {
    violations.push(`${targetName}: clamp comparison (if (<expr> > maxTop)) not found`);
    return violations;
  }
  const { conditionExpr, writeStmt } = extracted;

  // C1: the comparison reads the hoisted local — spelled IDENTICALLY on all
  // six targets, since a plain top-level `const` passes through the emitter
  // unchanged regardless of target.
  if (conditionExpr !== HOISTED_LOCAL_NAME) {
    violations.push(
      `${targetName}: clamp condition compares '${conditionExpr}', expected the hoisted local '${HOISTED_LOCAL_NAME}'`,
    );
  }

  // C2: the comparison does NOT read any of the six targets' reactive-holder
  // spellings (encoded as data, not hardcoded per-target logic).
  for (const [holderTarget, pattern] of Object.entries(HOLDER_READ_PATTERNS) as Array<[TargetName, RegExp]>) {
    if (pattern.test(conditionExpr)) {
      violations.push(
        `${targetName}: clamp condition reads the ${holderTarget}-shaped reactive holder ('${conditionExpr}') instead of the hoisted local`,
      );
    }
  }

  // C3: the WRITE on the clamped branch is still the target's normal
  // reactive write — the fix must not demote the holder.
  const expectedWrite = EXPECTED_WRITE_PATTERNS[targetName];
  if (!expectedWrite.test(writeStmt)) {
    violations.push(
      `${targetName}: clamp write '${writeStmt}' does not match the expected reactive-write shape (${expectedWrite})`,
    );
  }

  return violations;
}

describe('action-menu-clamp — CP-08 hoisted-local viewport clamp (six-leaf structural gate)', () => {
  it('the negative fixture proves the gate fires on React\'s actual defect shape (bare reactive-holder re-read)', () => {
    const negative = `
      requestAnimationFrame(() => {
        const menuEl: any = frame ? frame.querySelector('[data-command-palette-menu]') : null;
        if (menuEl && frame) {
          const frameTop = frame.getBoundingClientRect().top;
          const menuH = menuEl.getBoundingClientRect().height;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
          const maxTop = Math.max(0, vh - 8 - frameTop - menuH);
          if (actionMenuTop > maxTop) setActionMenuTop(maxTop);
        }
      });
    `;
    const violations = checkClampContract(negative, 'react');
    expect(violations).not.toEqual([]);
    expect(violations.some((v) => v.includes("expected the hoisted local 'anchorTop'"))).toBe(true);
    expect(violations.some((v) => v.includes('react-shaped reactive holder'))).toBe(true);
  });

  it('the negative fixture proves C3 fires when the clamped write demotes the reactive holder', () => {
    const negative = `
      requestAnimationFrame(() => {
        if (menuEl && frame) {
          const maxTop = Math.max(0, vh - 8 - frameTop - menuH);
          if (anchorTop > maxTop) actionMenuTopPlainLocal = maxTop;
        }
      });
    `;
    const violations = checkClampContract(negative, 'react');
    expect(violations).not.toEqual([]);
    expect(violations.some((v) => v.includes('does not match the expected reactive-write shape'))).toBe(true);
  });

  it('a correctly-shaped fixture per target reports zero violations', () => {
    const positiveByTarget: Record<TargetName, string> = {
      react: `if (anchorTop > maxTop) setActionMenuTop(maxTop);`,
      vue: `if (anchorTop > maxTop) actionMenuTop.value = maxTop;`,
      svelte: `if (anchorTop > maxTop) actionMenuTop = maxTop;`,
      solid: `if (anchorTop > maxTop) setActionMenuTop(maxTop);`,
      lit: `if (anchorTop > maxTop) this._actionMenuTop.value = maxTop;`,
      angular: `if (anchorTop > maxTop) this.actionMenuTop.set(maxTop);`,
    };
    for (const target of TARGETS) {
      expect(checkClampContract(positiveByTarget[target.name], target.name)).toEqual([]);
    }
  });

  for (const leaf of leaves) {
    it(`${leaf.id}: the viewport clamp compares against the hoisted local, not the reactive holder, and still writes it normally`, () => {
      expect(checkClampContract(leaf.source, leaf.id)).toEqual([]);
    });
  }
});

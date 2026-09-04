#!/usr/bin/env node
// scripts/check-readme-jsx-props.mjs — quick-260903-qw5 (E5 / P-04).
//
// THE DEFECT: a README custom-render example that passes the bare SLOT name
// as a JSX attribute (`option={(…) => …}`) instead of the emitted component's
// actual render-prop name (`renderOption`). A reader who copy-pastes that
// example gets code that silently no-ops (React/Solid ignore an unknown prop)
// — never a compile error, so nothing catches it short of reading the
// generated `.d.ts`/`.tsx` by hand.
//
// THIS GATE closes that gap mechanically: for every `packages/ui/<family>/
// packages/{react,solid}` leaf that publishes both a `README.md` and a
// `src/`, it (a) parses every `src/*.d.ts` and `src/*.tsx` for `interface
// <Name>Props { … }` blocks and collects their DEPTH-1 member names only —
// a whole-file identifier search is NOT sufficient: a slot-param object
// literal nested inside a render-prop signature (e.g. `renderOption?:
// (params: { option: unknown; … }) => ReactNode`) contains the very
// identifier a bad example uses, so a naive substring/whole-file search
// false-negatives on exactly the leaf (combobox) this gate exists to catch;
// (b) scans the README for JSX attributes written with an inline arrow or
// object VALUE (the render-prop calling convention), and (c) reports any
// attribute name that is not a declared depth-1 Props member.
//
// `KNOWN_UNFIXED` is a narrow, per-(family, target, attr) allowlist for bugs
// of this same class OUT of the current wave's fence. It is SELF-CLEARING:
// if an allowlisted triple stops reproducing (because someone fixed it), the
// gate fails loudly demanding the stale entry be removed — an allowlist must
// never quietly outlive the bug it was written to suppress.
//
// `--family <name>` restricts the sweep to one family (used by per-task
// verification during incremental fixes); no flag sweeps all families.
//
// Structure mirrors scripts/check-dep-drift.mjs and
// scripts/check-sidecar-staleness.mjs (the repo's other dependency-free
// `.mjs` gates): `import.meta.url` ROOT anchoring, clear exit-non-zero
// messaging, zero runtime dependencies.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_ROOT = join(ROOT, 'packages', 'ui');

const TARGETS = ['react', 'solid'];

// JSX attributes written with an inline arrow or object VALUE — the render-
// prop calling convention this gate is checking. A plain string/identifier
// attribute (`placeholder="…"`, `value={value}`) is not in scope: those are
// not render-prop slot examples and cannot carry this specific defect.
const JSX_RENDER_PROP_ATTR = /^\s+([a-zA-Z][A-Za-z0-9]*)=\{[({]/gm;

/**
 * Out-of-wave same-bug-class instances, tracked here so the gate stays GREEN
 * repo-wide without silently losing the defect. Each entry must reproduce a
 * real mismatch every run — see the self-clearing check below.
 */
const KNOWN_UNFIXED = [
  {
    family: 'resizable',
    target: 'solid',
    attr: 'renderStart',
    reason:
      "Solid's declared prop is `startSlot`, not `renderStart` — same bug class as combobox/popover, " +
      'out of the 260903-qw5 wave fence (combobox/popover/command-palette only). See ' +
      '.planning/quick/260903-qw5-docs-pass-fix-the-readme-mjs-slot-exampl/260903-qw5-PLAN.md measured_baseline.',
  },
  {
    family: 'resizable',
    target: 'solid',
    attr: 'renderEnd',
    reason:
      "Solid's declared prop is `endSlot`, not `renderEnd` — same bug class as combobox/popover, " +
      'out of the 260903-qw5 wave fence. See the same measured_baseline note as `renderStart` above.',
  },
];

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Split an interface's interior text on top-level (brace-depth-0) `;`
 * separators and pull the leading identifier off each segment. Depth is
 * tracked ONLY on `{`/`}` — a nested object-literal type inside a render-prop
 * signature's params (`(params: { option: unknown; … })`) pushes depth to 1,
 * so the `;` separators INSIDE it are never mistaken for member boundaries.
 */
function collectDepth1Members(interiorText) {
  const members = [];
  let depth = 0;
  let current = '';
  for (const ch of interiorText) {
    if (ch === '{') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === '}') {
      depth--;
      current += ch;
      continue;
    }
    if (ch === ';' && depth === 0) {
      members.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) members.push(current);

  const names = [];
  for (const seg of members) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([a-zA-Z_$][\w$]*)\??\s*:/);
    if (m) names.push(m[1]);
  }
  return names;
}

/** Brace-match every `interface <Name>Props { … }` block in `fileText` and
 * return a Map of interface name -> depth-1 member names. */
function extractPropsInterfaces(fileText) {
  const text = stripComments(fileText);
  const results = new Map();
  const re = /interface\s+(\w+Props)\s*\{/g;
  let match;
  while ((match = re.exec(text))) {
    const name = match[1];
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
    }
    const bodyEnd = i - 1;
    const interior = text.slice(bodyStart, bodyEnd);
    results.set(name, collectDepth1Members(interior));
  }
  return results;
}

/** Union of every `*Props` interface's depth-1 members declared anywhere in
 * a leaf's `src/*.d.ts` / `src/*.tsx` files. */
function declaredPropNames(srcDir) {
  const names = new Set();
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(d\.ts|tsx)$/.test(entry.name)) continue;
    const text = readFileSync(join(srcDir, entry.name), 'utf8');
    for (const members of extractPropsInterfaces(text).values()) {
      for (const m of members) names.add(m);
    }
  }
  return names;
}

/** Every JSX attribute name in `readmeText` written with an inline arrow or
 * object value. */
function readmeRenderPropAttrs(readmeText) {
  const attrs = [];
  let match;
  JSX_RENDER_PROP_ATTR.lastIndex = 0;
  while ((match = JSX_RENDER_PROP_ATTR.exec(readmeText))) {
    attrs.push(match[1]);
  }
  return attrs;
}

function findLeaves(familyFilter) {
  const leaves = [];
  for (const familyEntry of readdirSync(UI_ROOT, { withFileTypes: true })) {
    if (!familyEntry.isDirectory()) continue;
    const family = familyEntry.name;
    if (familyFilter && family !== familyFilter) continue;
    for (const target of TARGETS) {
      const leafDir = join(UI_ROOT, family, 'packages', target);
      const readmePath = join(leafDir, 'README.md');
      const srcDir = join(leafDir, 'src');
      if (!existsSync(readmePath) || !existsSync(srcDir)) continue;
      leaves.push({ family, target, readmePath, srcDir });
    }
  }
  return leaves;
}

function main() {
  const args = process.argv.slice(2);
  const familyIdx = args.indexOf('--family');
  const familyFilter = familyIdx !== -1 ? args[familyIdx + 1] : null;

  const leaves = findLeaves(familyFilter);
  if (leaves.length === 0) {
    console.error(
      `check-readme-jsx-props: no leaves found${familyFilter ? ` for --family ${familyFilter}` : ''}.`,
    );
    process.exit(1);
  }

  const failures = [];
  const usedAllowlistKeys = new Set();

  for (const { family, target, readmePath, srcDir } of leaves) {
    const declared = declaredPropNames(srcDir);
    const readmeText = readFileSync(readmePath, 'utf8');
    const attrs = readmeRenderPropAttrs(readmeText);

    for (const attr of attrs) {
      if (declared.has(attr)) continue;

      const allowEntry = KNOWN_UNFIXED.find(
        (e) => e.family === family && e.target === target && e.attr === attr,
      );
      if (allowEntry) {
        usedAllowlistKeys.add(`${family}/${target}/${attr}`);
        continue;
      }

      failures.push(
        `${family}/${target}: README attribute \`${attr}\` is not a declared Props member ` +
          `(checked ${srcDir}).`,
      );
    }
  }

  // Self-clearing allowlist: an entry that no longer reproduces a mismatch on
  // THIS run (because the leaf/target it names was actually swept) means the
  // bug was fixed and the suppression is now stale — fail loudly rather than
  // silently keep suppressing a defect that no longer exists.
  const staleEntries = [];
  for (const entry of KNOWN_UNFIXED) {
    const swept = leaves.some((l) => l.family === entry.family && l.target === entry.target);
    if (!swept) continue; // not in this run's scope (e.g. --family filter) — can't judge staleness.
    const key = `${entry.family}/${entry.target}/${entry.attr}`;
    if (!usedAllowlistKeys.has(key)) {
      staleEntries.push(
        `${key}: allowlisted but reported NO mismatch this run — the bug appears fixed. ` +
          `Remove this entry from KNOWN_UNFIXED in scripts/check-readme-jsx-props.mjs.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('check-readme-jsx-props: FAILED — unsuppressed README/Props mismatches:\n');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
  }
  if (staleEntries.length > 0) {
    console.error('check-readme-jsx-props: FAILED — stale KNOWN_UNFIXED allowlist entries:\n');
    for (const s of staleEntries) console.error(`  - ${s}`);
    console.error('');
  }

  if (failures.length > 0 || staleEntries.length > 0) {
    process.exit(1);
  }

  console.log(
    `check-readme-jsx-props: OK — ${leaves.length} leaf README(s) checked against their emitted Props interfaces.`,
  );
}

main();

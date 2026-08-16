/**
 * gen-theming-pages.mjs — generate one "<Name> theming" page per @rozie-ui
 * component family that ships a `src/themes/base.css`.
 *
 * Single source of truth: each family's own `src/themes/base.css` is the
 * complete public `--rozie-*` token surface (reconciled in phase 78-01/02).
 * This script parses that file directly — declaration names, values, and the
 * `/* group *​/` comments that precede them — and cross-references it against
 * every literal `var(<prefix>…)` read under the family's `src/` (excluding
 * `themes/` and `node_modules/`) so an undeclared-but-read token still shows
 * up (flagged) rather than silently vanishing.
 *
 * There is deliberately NO per-family configuration map anywhere in this
 * file: the public token prefix is derived mechanically as the longest
 * common segment-prefix of the file's own `--rozie-*` declaration names.
 *
 * The emitted pages (`docs/components/<slug>-theming.md`) are generated
 * artifacts — do NOT edit them by hand; edit the family's `src/themes/base.css`
 * and re-run. Wired into `docs` `dev`/`build`, BEFORE `gen-usage-pages.mjs`,
 * so `relatedLinks()` can find these pages on disk via `existsSync`.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COMPONENTS_DIR, UI_DIR, displayNameFor } from './display-name.mjs';

/** Longest common segment-prefix (hyphen-delimited) of a set of token names.
 * Reused verbatim from the phase's probe-tokens.mjs prototype. */
function commonPrefix(names) {
  if (!names.length) return '';
  const segs = names.map((n) => n.split('-'));
  const first = segs[0];
  let i = 0;
  while (i < first.length && segs.every((s) => s[i] === first[i])) i++;
  return first.slice(0, i).join('-') + '-';
}

/** Walk a directory recursively, skipping `themes/` and `node_modules/`. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'themes' && e.name !== 'node_modules') walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

/** Longest a comment may be and still read as a section LABEL rather than
 * prose. Set just above the longest real label in the corpus
 * (`track colors — off vs on (on is the single accent most consumers set)`)
 * and well below the shortest explanatory note. */
const MAX_LABEL_LENGTH = 72;

/** Strip a block comment's delimiters, collapse it to one line, and shed any
 * box-drawing decoration at the edges. `data-table` rules its section labels
 * off with them (`/* ── header ─────────… *​/`), which is a ruler in a CSS
 * file but noise in an H3 — and long enough to push a genuine label past
 * MAX_LABEL_LENGTH. Interior dashes are untouched. */
function commentText(raw) {
  return raw
    .slice(2, -2)
    .replace(/\s+/g, ' ')
    .replace(/^[\s─—–-]+|[\s─—–-]+$/g, '')
    .trim();
}

/** A comment reads as a section label when it is a single line, short, and
 * not a doc block. `base.css` comments were written for CSS readers, not as
 * headings: some are labels (`focus ring`, `── header ──`), others are
 * paragraphs explaining WHY a token is declared the way it is. Only the
 * former belong in an H3 — the latter are real content, rendered as prose
 * above the group's table. Without this guard `popover`, whose base.css has
 * no group comments at all, headings its one table with the entire file-head
 * doc block. */
function isLabel(raw) {
  if (raw.includes('\n')) return false;
  return commentText(raw).length <= MAX_LABEL_LENGTH;
}

/** Every base.css opens with a `/*\n * @rozie-ui/<family> — base token
 * reference.\n * … *​/` doc block explaining the file itself. It is neither a
 * label nor a note about any group — it documents the FILE — so it is dropped
 * outright. Collapsing such a block leaves its per-line `*` prefixes behind,
 * which is what identifies it. */
function isDocBlock(raw) {
  return commentText(raw).startsWith('*');
}

/** Parse `base.css` into an ordered list of
 * `{ name, value, groupKey, label, note }`, keeping only the FIRST occurrence
 * of each declaration name — a multi-block file may declare the same token up
 * to three times (a light root rule, a `.dark`/`[data-theme]` override, and an
 * OS `@media` query) and the first (light) occurrence is the documented
 * default.
 *
 * Each run of `/* … *​/` comments preceding a declaration opens a new group.
 * The run's last LABEL becomes the heading (so a label followed by a note, and
 * a note followed by a label, both resolve to the label); every non-label
 * comment in the run becomes the group's note. A run with no label yields a
 * headingless group carrying just its note. */
function parseDeclarations(css) {
  const SCAN = /\/\*[\s\S]*?\*\/|^[ \t]*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm;
  let current = { groupKey: 0, label: '', note: '' };
  let groupKey = 0;
  let run = [];
  const seen = new Set();
  const decls = [];
  for (const m of css.matchAll(SCAN)) {
    if (m[0].startsWith('/*')) {
      run.push(m[0]);
      continue;
    }
    if (run.length) {
      run = run.filter((c) => !isDocBlock(c));
      const labels = run.filter(isLabel);
      const notes = run.filter((c) => !isLabel(c));
      current = {
        groupKey: ++groupKey,
        label: labels.length ? commentText(labels[labels.length - 1]) : '',
        note: notes.map(commentText).join(' '),
      };
      run = [];
    }
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    decls.push({ name, value: m[2].trim(), ...current });
  }
  return decls;
}

/** The first rule's full selector text, verbatim, from just after the file's
 * leading doc-comment block to its opening brace — kept whole (not split on
 * commas) so a multi-selector rule like data-table's stays a faithful copy. */
function firstSelector(css) {
  const withoutHeadComment = css.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  const braceIdx = withoutHeadComment.indexOf('{');
  return withoutHeadComment.slice(0, braceIdx).trim();
}

/** Anti-prose read-scan: requires at least one real segment after the prefix
 * and a trailing `,` or `)`, so `.rozie` comment prose like
 * `var(--rozie-switch-*, <fallback>)` is never captured as a bare-prefix
 * pseudo-token. Reused verbatim from probe-tokens.mjs. */
function scanReads(srcDir, prefix) {
  const found = new Set();
  for (const file of walk(srcDir)) {
    let txt;
    try {
      txt = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of txt.matchAll(/var\(\s*(--[a-z0-9]+(?:-[a-z0-9]+)*)\s*[,)]/g)) {
      if (m[1].startsWith(prefix)) found.add(m[1]);
    }
  }
  return found;
}

/** Escape `|` inside a table cell so a multi-value CSS default (e.g. a
 * `font` shorthand with commas is fine, but a value containing a literal
 * pipe would otherwise restructure the row) can never break the table. */
function cell(text) {
  return `\`${String(text).replace(/\|/g, '\\|')}\``;
}

/** Escape a leading `<` in raw (non-backticked) markdown text sourced from a
 * CSS comment. Group headings are plain H3 text, not code spans — a comment
 * that names an HTML/JSX tag verbatim (e.g. `<Combobox>`, `<div>`) would
 * otherwise be parsed as an unterminated element by VitePress's Vue-based
 * markdown compiler and fail the build. Only `<` is escaped (not `>`) so a
 * comment merely containing a bare `>` (e.g. "depth>0") stays untouched. */
function escapeAngles(text) {
  return String(text).replace(/</g, '&lt;');
}

function renderPage(slug, name, prefix, groups, undeclared, overrides, selector, bridgeFiles, seeAlso) {
  const parts = [];
  parts.push('---');
  parts.push(`title: ${name} theming`);
  parts.push('outline: [2, 3]');
  parts.push('---');
  parts.push('');
  parts.push(
    `<!-- GENERATED by docs/scripts/gen-theming-pages.mjs from packages/ui/${slug}/src/themes/base.css — do not edit by hand. -->`,
  );
  parts.push('');
  parts.push(`# ${name} theming`);
  parts.push('');
  parts.push(
    `Every cosmetic value \`${name}\` renders is a \`${prefix}*\` custom property with a built-in fallback, so the component works with **zero configuration** and stays fully re-skinnable. The structural rules compile per-leaf and are **not** consumer-overridable — only the values below flow through tokens.`,
  );
  parts.push('');
  parts.push('```css');
  parts.push(`${selector} {`);
  for (const d of overrides) parts.push(`  ${d.name}: ${d.value};`);
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push('## Tokens');
  parts.push('');
  for (const entries of groups.values()) {
    const { label, note } = entries[0];
    // A group without a label gets no heading — its tokens simply follow the
    // previous table. Its note (if any) still renders, so nothing authored in
    // base.css is lost just because it was written as prose rather than a label.
    if (label) {
      parts.push(`### ${escapeAngles(label)}`);
      parts.push('');
    }
    if (note) {
      parts.push(escapeAngles(note));
      parts.push('');
    }
    parts.push('| Token | Default |');
    parts.push('| --- | --- |');
    for (const d of entries) parts.push(`| ${cell(d.name)} | ${cell(d.value)} |`);
    parts.push('');
  }
  if (undeclared.length) {
    parts.push('### Undeclared in base.css');
    parts.push('');
    parts.push('| Token | Default |');
    parts.push('| --- | --- |');
    for (const name of undeclared) parts.push(`| ${cell(name)} | — |`);
    parts.push('');
  }
  parts.push('## Design-system bridges');
  parts.push('');
  parts.push(
    `Each package ships token presets that map ${name}'s tokens onto a known design system's published CSS variables — import \`base.css\` first, then a bridge:`,
  );
  parts.push('');
  parts.push('```ts');
  for (const file of bridgeFiles) parts.push(`import '@rozie-ui/${slug}-react/themes/${file}';`);
  parts.push('```');
  parts.push('');
  parts.push('## See also');
  parts.push('');
  for (const link of seeAlso) parts.push(`- ${link}`);
  parts.push('');
  return parts.join('\n');
}

function main() {
  const families = readdirSync(UI_DIR, { withFileTypes: true })
    .filter((d) => {
      if (!d.isDirectory()) return false;
      try {
        return statSync(join(UI_DIR, d.name, 'src', 'themes', 'base.css')).isFile();
      } catch {
        return false;
      }
    })
    .map((d) => d.name)
    .sort();

  const written = [];
  for (const slug of families) {
    const themesDir = join(UI_DIR, slug, 'src', 'themes');
    const baseCssPath = join(themesDir, 'base.css');
    const css = readFileSync(baseCssPath, 'utf8');
    const name = displayNameFor(slug);

    const allDecls = parseDeclarations(css);
    const rozieNames = allDecls.filter((d) => d.name.startsWith('--rozie-')).map((d) => d.name);
    const prefix = commonPrefix(rozieNames);
    const publicDecls = allDecls.filter((d) => d.name.startsWith(prefix));

    const declaredSet = new Set(publicDecls.map((d) => d.name));
    const readNames = scanReads(join(UI_DIR, slug, 'src'), prefix);
    const undeclared = [...readNames].filter((n) => !declaredSet.has(n)).sort();
    if (undeclared.length) {
      console.warn(`[gen-theming-pages] ${slug}: ${undeclared.length} token(s) read but undeclared in base.css: ${undeclared.join(', ')}`);
    }

    // Keyed by groupKey, not by heading text — two headingless groups would
    // otherwise collide into one table.
    const groups = new Map();
    for (const d of publicDecls) {
      if (!groups.has(d.groupKey)) groups.set(d.groupKey, []);
      groups.get(d.groupKey).push(d);
    }
    const groupKeys = [...groups.keys()];
    const overrides =
      groupKeys.length >= 4 ? groupKeys.slice(0, 4).map((g) => groups.get(g)[0]) : publicDecls.slice(0, 4);

    const selector = firstSelector(css);

    const bridgeFilesRaw = readdirSync(themesDir).filter((f) => f.endsWith('.css'));
    const bridgeRest = bridgeFilesRaw.filter((f) => f !== 'base.css').sort();
    const bridgeFiles = bridgeFilesRaw.includes('base.css') ? ['base.css', ...bridgeRest] : bridgeRest;

    const seeAlso = [];
    if (existsSync(resolve(COMPONENTS_DIR, `${slug}.md`))) {
      seeAlso.push(`[${name} — showcase & API](/components/${slug}) — the full prop / event / slot / handle reference.`);
    }
    if (existsSync(resolve(COMPONENTS_DIR, `${slug}-api.md`))) {
      seeAlso.push(`[${name} — API reference](/components/${slug}-api) — every prop, event, slot, and handle verb.`);
    }
    if (existsSync(resolve(COMPONENTS_DIR, `${slug}-usage.md`))) {
      seeAlso.push(`[${name} — usage examples](/components/${slug}-usage) — idiomatic per-framework consumption code.`);
    }
    if (existsSync(resolve(COMPONENTS_DIR, `${slug}-comparison.md`))) {
      seeAlso.push(`[${name} comparison](/components/${slug}-comparison) — how it stacks up against the per-framework libraries.`);
    }
    if (existsSync(resolve(COMPONENTS_DIR, `${slug}-demo.md`))) {
      seeAlso.push(`[${name} — live demo](/components/${slug}-demo) — the real package running in the page.`);
    }

    const page = renderPage(slug, name, prefix, groups, undeclared, overrides, selector, bridgeFiles, seeAlso);
    const out = resolve(COMPONENTS_DIR, `${slug}-theming.md`);
    writeFileSync(out, page);
    written.push(`${slug} → ${name} (${publicDecls.length} tokens)`);
  }

  console.log(`[gen-theming-pages] wrote ${written.length} theming pages:`);
  for (const w of written) console.log(`  - ${w}`);
}

main();

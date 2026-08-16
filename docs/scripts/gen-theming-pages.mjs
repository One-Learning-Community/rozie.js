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

/** Parse `base.css` into an ordered list of `{ name, value, group }`,
 * keeping only the FIRST occurrence of each declaration name — a
 * multi-block file may declare the same token up to three times (a light
 * root rule, a `.dark`/`[data-theme]` override, and an OS `@media` query)
 * and the first (light) occurrence is the documented default. `group` is
 * the most recently preceding `/* … *​/` block comment, verbatim minus its
 * delimiters, collapsed to one line. */
function parseDeclarations(css) {
  const SCAN = /\/\*[\s\S]*?\*\/|^[ \t]*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm;
  let currentGroup = '';
  const seen = new Set();
  const decls = [];
  for (const m of css.matchAll(SCAN)) {
    if (m[0].startsWith('/*')) {
      currentGroup = m[0]
        .slice(2, -2)
        .replace(/\s+/g, ' ')
        .trim();
      continue;
    }
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    decls.push({ name, value: m[2].trim(), group: currentGroup });
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
  for (const [group, entries] of groups) {
    parts.push(`### ${escapeAngles(group)}`);
    parts.push('');
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

    const groups = new Map();
    for (const d of publicDecls) {
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group).push(d);
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

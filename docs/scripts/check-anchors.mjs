#!/usr/bin/env node
/**
 * check-anchors.mjs — docs anchor-link drift gate.
 *
 * VitePress's dead-link check validates page PATHS but never `#fragment`
 * anchors, and VitePress keeps unicode chars (`—`, `→`) in heading slugs —
 * so a hand-written anchor that omits them 404s silently. 2026-06-01 found
 * 20 such broken cross-page anchors (fixed in ae0e51c5); this gate prevents
 * recurrence by failing the docs build when any internal anchored link does
 * not resolve to a real `id="..."` in the built HTML.
 *
 * Runs AFTER `vitepress build .` (wired into the docs `build` script). For
 * every `docs/**\/*.md` (excluding node_modules / .vitepress), it extracts:
 *
 *   - cross-page anchored links:  ](/guide/features#some-anchor)
 *   - same-page anchored links:   ](#some-anchor)
 *
 * resolves the built page under `.vitepress/dist/` (cleanUrls: true →
 * `/guide/features` maps to `dist/guide/features.html`, `/guide/` maps to
 * `dist/guide/index.html`), and asserts the (URL-decoded) anchor matches an
 * `id="..."` attribute in that page. Links inside fenced code blocks and
 * inline code spans are ignored (they're examples, not navigation).
 *
 * Dependency-free: node:fs + regex only.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(docsRoot, '.vitepress', 'dist');

if (!existsSync(distRoot)) {
  console.error(
    `check-anchors: built site not found at ${path.relative(process.cwd(), distRoot)} — run \`vitepress build .\` first.`,
  );
  process.exit(1);
}

/** Recursively collect every .md file under `dir`, skipping non-source dirs. */
function collectMarkdown(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.vitepress') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectMarkdown(full));
    else if (ent.isFile() && ent.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Map a root-relative site path (no #fragment) to its built HTML file.
 * cleanUrls: true →  '/guide/features' → dist/guide/features.html
 *                    '/guide/'         → dist/guide/index.html
 *                    '/'               → dist/index.html
 * Tolerates explicit '.html' and a hardcoded '/rozie.js/' base prefix.
 */
function distPathFor(sitePath) {
  let p = sitePath;
  if (p.startsWith('/rozie.js/')) p = p.slice('/rozie.js'.length);
  p = p.replace(/^\//, '');
  if (p === '' || p.endsWith('/')) p += 'index.html';
  else if (!p.endsWith('.html')) p += '.html';
  return path.join(distRoot, p);
}

/** Map a source .md file to its built HTML file (for same-page #anchors). */
function distPathForMarkdown(mdFile) {
  const rel = path.relative(docsRoot, mdFile).replace(/\.md$/, '.html');
  return path.join(distRoot, rel);
}

/** Lazily-cached set of id="..." values per built HTML file. */
const idCache = new Map();
function idsOf(htmlFile) {
  if (idCache.has(htmlFile)) return idCache.get(htmlFile);
  let ids = null;
  if (existsSync(htmlFile) && statSync(htmlFile).isFile()) {
    ids = new Set();
    const html = readFileSync(htmlFile, 'utf8');
    for (const m of html.matchAll(/\bid="([^"]*)"/g)) ids.add(m[1]);
  }
  idCache.set(htmlFile, ids); // null = page missing
  return ids;
}

// Matches `](/path#anchor)` and `](#anchor)`, with an optional markdown
// title (`](/path#anchor "title")`). Group 1 = path ('' for same-page),
// group 2 = anchor.
const LINK_RE = /\]\((\/[^)#\s]*)?#([^)\s]+)(?:\s+"[^"]*")?\)/g;

const broken = [];
let checked = 0;

for (const mdFile of collectMarkdown(docsRoot)) {
  const relMd = path.relative(docsRoot, mdFile);
  const lines = readFileSync(mdFile, 'utf8').split('\n');
  let inFence = false;

  lines.forEach((rawLine, i) => {
    // Skip fenced code blocks (``` / ~~~) and strip inline code spans —
    // links there are illustrative, not navigation.
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const line = rawLine.replace(/`[^`]*`/g, '');

    for (const m of line.matchAll(LINK_RE)) {
      checked++;
      const [, pagePath, rawAnchor] = m;
      const htmlFile = pagePath ? distPathFor(pagePath) : distPathForMarkdown(mdFile);
      const ids = idsOf(htmlFile);
      let anchor;
      try {
        anchor = decodeURIComponent(rawAnchor);
      } catch {
        anchor = rawAnchor; // malformed %-escape — compare raw
      }

      if (ids === null) {
        broken.push({
          source: `${relMd}:${i + 1}`,
          link: m[0],
          reason: `target page not found in build output (${path.relative(distRoot, htmlFile)})`,
        });
      } else if (!ids.has(anchor)) {
        broken.push({
          source: `${relMd}:${i + 1}`,
          link: m[0],
          reason: `no id="${anchor}" in ${path.relative(distRoot, htmlFile)}`,
        });
      }
    }
  });
}

if (broken.length > 0) {
  console.error(`\ncheck-anchors: ${broken.length} broken anchor link(s):\n`);
  for (const b of broken) {
    console.error(`  ${b.source}`);
    console.error(`    ${b.link}`);
    console.error(`    → ${b.reason}\n`);
  }
  console.error(
    'Anchors must match the heading slug exactly as VitePress generates it (unicode chars like — and → are KEPT in slugs).',
  );
  console.error('Inspect the built page in docs/.vitepress/dist/ for the real id="..." value.');
  process.exit(1);
}

console.log(`check-anchors: ${checked} anchored link(s) verified, 0 broken.`);

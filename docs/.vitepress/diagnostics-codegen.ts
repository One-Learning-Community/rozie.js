/**
 * diagnostics-codegen — VitePress markdown-it plugin that generates the ROZ
 * diagnostic-code reference table LIVE from the compiler source.
 *
 * The single fence kind it recognizes is:
 *
 *   ```rozie-diagnostics
 *   ```
 *     → replaced with the full set of cluster sections + 3-column tables
 *       (Code | Severity | Cause), parsed from
 *       `packages/core/src/diagnostics/codes.ts`.
 *
 * The fence body in the .md source is ignored — it is regenerated on every
 * `vitepress build` / `vitepress dev` by scanning the real `codes.ts` TEXT, so
 * the reference page can never drift from the compiler.
 *
 * Why parse as TEXT (not import the module): importing `RozieErrorCode` yields
 * only the `ROZxxx` string VALUES and loses the comments — but the comments
 * carry the severity + cause we render. We DO cross-check the scanned set
 * against the imported barrel to assert no entry was silently missed.
 *
 * Implementation mirrors `rozie-codegen.ts`: a markdown-it `core` ruler mutates
 * the placeholder `fence` token (into an `html_block`) BEFORE VitePress renders.
 */
import { readFileSync } from 'node:fs';
import { RozieErrorCode } from '@rozie/core';
import type MarkdownIt from 'markdown-it';

export interface DiagnosticsCodegenOptions {
  /** Absolute path to `packages/core/src/diagnostics/codes.ts`. */
  codesPath: string;
}

interface DiagnosticEntry {
  member: string;
  code: string;
  severity: string;
  cause: string;
}

interface DiagnosticCluster {
  title: string;
  id: string;
  entries: DiagnosticEntry[];
}

/** A full-line cluster header: `// ---- <title> ... ----` (also tolerates `=`). */
const CLUSTER_HEADER_RE = /^\s*\/\/\s*[-=]{2,}\s*(.*?)\s*[-=]{2,}\s*$/;
/** An entry line: `MEMBER: 'ROZ123',` optionally with a trailing `// comment`. */
const ENTRY_RE = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*'(ROZ\d+)'\s*,?\s*(?:\/\/\s*(.*))?$/;

const SEVERITY_RE = /\b(error|warning|warn|info|fatal|notice)\b/i;

function normalizeSeverity(raw: string): string {
  const m = raw.match(SEVERITY_RE);
  if (!m) return '-';
  const s = m[1].toLowerCase();
  return s === 'warn' ? 'warning' : s;
}

/** Collapse a multi-line comment blob to a single trimmed first-sentence-ish line. */
function deriveCause(blob: string): string {
  // Strip an explicit leading severity token + its trailing punctuation so the
  // cause text doesn't redundantly repeat "error —" / "warning:".
  let text = blob.replace(/\s+/g, ' ').trim();
  if (!text) return '-';
  // Drop a leading "error —"/"warning:"/"warn -" prefix (the severity column owns it).
  text = text.replace(/^(error|warning|warn|info|fatal|notice)\b\s*[—:\-–]*\s*/i, '').trim();
  if (!text) return '-';
  // First sentence: up to the first ". " boundary, else the whole line.
  const dot = text.indexOf('. ');
  if (dot !== -1) text = text.slice(0, dot + 1);
  return text.trim() || '-';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(title: string): string {
  return (
    'roz-' +
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

export function parseCodes(source: string): DiagnosticCluster[] {
  const lines = source.split('\n');
  const clusters: DiagnosticCluster[] = [];
  let current: DiagnosticCluster | null = null;
  // Accumulated leading-comment lines for the NEXT entry (reset on blank /
  // non-comment / cluster-header / after an entry consumes them).
  let leading: string[] = [];

  const ensureGeneral = (): DiagnosticCluster => {
    if (!current) {
      current = { title: 'General', id: slugify('General'), entries: [] };
      clusters.push(current);
    }
    return current;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Cluster header — starts a new section. Must NOT be swallowed as a
    // leading comment for an entry; reset the accumulator.
    const headerMatch = line.match(CLUSTER_HEADER_RE);
    if (headerMatch) {
      const title = headerMatch[1].trim() || 'Diagnostics';
      current = { title, id: slugify(title), entries: [] };
      clusters.push(current);
      leading = [];
      continue;
    }

    // Entry line.
    const entryMatch = line.match(ENTRY_RE);
    if (entryMatch) {
      const [, member, code, trailing] = entryMatch;
      const commentBlob = trailing
        ? trailing
        : leading.join(' ');
      const severity = normalizeSeverity(commentBlob);
      const cause = deriveCause(commentBlob);
      ensureGeneral().entries.push({ member, code, severity, cause });
      leading = [];
      continue;
    }

    // Leading-comment accumulation: `/** ... */`, `/* ... */`, or `//` runs.
    const trimmed = line.trim();
    if (trimmed === '') {
      leading = [];
      continue;
    }
    if (trimmed.startsWith('//')) {
      leading.push(trimmed.replace(/^\/\/\s?/, ''));
      continue;
    }
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      const cleaned = trimmed
        .replace(/^\/\*+\s?/, '')
        .replace(/\s*\*+\/\s*$/, '')
        .replace(/^\*+\s?/, '')
        .trim();
      if (cleaned) leading.push(cleaned);
      continue;
    }
    // Any other non-comment, non-entry line breaks the leading run.
    leading = [];
  }

  return clusters.filter((c) => c.entries.length > 0);
}

function renderTable(cluster: DiagnosticCluster): string {
  const rows = cluster.entries
    .map((e) => {
      const codeCell =
        `<code>${escapeHtml(e.code)}</code> ` +
        `<span style="opacity:0.55;font-size:0.85em">${escapeHtml(e.member)}</span>`;
      return (
        `<tr>` +
        `<td>${codeCell}</td>` +
        `<td>${escapeHtml(e.severity)}</td>` +
        `<td>${escapeHtml(e.cause)}</td>` +
        `</tr>`
      );
    })
    .join('\n');
  // `v-pre` on the table: cause/message text is static generated content and
  // may legitimately contain `{{`/`}}` (e.g. ROZ051, the malformed-mustache
  // code), which VitePress's Vue compiler would otherwise parse as an
  // interpolation and fail the build. v-pre makes Vue skip compiling the table.
  return (
    `<h2 id="${cluster.id}" tabindex="-1">${escapeHtml(cluster.title)} ` +
    `<a class="header-anchor" href="#${cluster.id}" aria-label="Permalink to &quot;${escapeHtml(cluster.title)}&quot;">&ZeroWidthSpace;</a></h2>\n` +
    `<table v-pre>\n` +
    `<thead><tr><th>Code</th><th>Severity</th><th>Cause</th></tr></thead>\n` +
    `<tbody>\n${rows}\n</tbody>\n` +
    `</table>`
  );
}

export function diagnosticsCodegen(
  md: MarkdownIt,
  opts: DiagnosticsCodegenOptions,
): void {
  md.core.ruler.push('rozie-diagnostics', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue;
      if (!token.info.trim().startsWith('rozie-diagnostics')) continue;

      const source = readFileSync(opts.codesPath, 'utf8');
      const clusters = parseCodes(source);

      // Cross-check: every code in the imported barrel must appear in the scan.
      const scanned = new Set(
        clusters.flatMap((c) => c.entries.map((e) => e.code)),
      );
      const missing = Object.values(RozieErrorCode).filter(
        (code) => !scanned.has(code),
      );
      if (missing.length > 0) {
        throw new Error(
          `[diagnostics-codegen] ${missing.length} code(s) in @rozie/core were not ` +
            `found by the text scan of codes.ts: ${missing.join(', ')}. ` +
            `The parser regex likely needs updating.`,
        );
      }

      token.type = 'html_block';
      token.content = clusters.map(renderTable).join('\n\n') + '\n';
      token.info = '';
      token.tag = '';
    }
  });
}

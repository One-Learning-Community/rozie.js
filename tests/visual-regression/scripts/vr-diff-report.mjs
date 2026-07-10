#!/usr/bin/env node
/*
 * vr-diff-report.mjs — collect Playwright visual-regression screenshot
 * deviations into ONE self-contained HTML page for side-by-side inspection.
 *
 * Playwright writes a directory per failing `toHaveScreenshot` assertion under
 * `test-results/`, each holding `<snap>-expected.png`, `<snap>-actual.png`, and
 * `<snap>-diff.png` (plus `-retryN` sibling dirs for the retries). When a run
 * happens in the pinned Linux container via `tools/ci-repro/vr.sh`, those
 * artifacts land in the sibling mirror at
 * `../<repo>-ci-linux/tests/visual-regression/test-results/`.
 *
 * This scans a results dir, embeds every PNG as a base64 data URI, and emits a
 * single PORTABLE html file (no external assets): one card per deviation with
 * Expected | Actual | Diff panes, dimensions, and an opacity cross-fader that
 * overlays actual on expected so subtle differences pop. Retry dirs are folded
 * into their canonical run.
 *
 * Usage:
 *   node scripts/vr-diff-report.mjs [resultsDir] [-o|--out <file>] [--open]
 *
 *   resultsDir  defaults to <vr-root>/test-results; pass the mirror path to
 *               inspect a Docker/CI run, e.g.
 *               node scripts/vr-diff-report.mjs ../rozie-ci-linux/tests/visual-regression/test-results
 *   -o, --out   output html path (default <vr-root>/vr-diff-report.html)
 *   --open      open the report in the default browser when done
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VR_ROOT = resolve(HERE, '..');
const KINDS = /** @type {const} */ (['expected', 'actual', 'diff']);

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let resultsArg = null;
let outArg = null;
let open = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-o' || a === '--out') outArg = argv[++i];
  else if (a === '--open') open = true;
  else if (a === '-h' || a === '--help') {
    console.log(
      'Usage: node scripts/vr-diff-report.mjs [resultsDir] [-o out.html] [--open]',
    );
    process.exit(0);
  } else if (!a.startsWith('-')) resultsArg = a;
  else {
    console.error(`[vr-diff-report] unknown flag: ${a}`);
    process.exit(2);
  }
}
const resultsDir = resolve(resultsArg ?? join(VR_ROOT, 'test-results'));
const outFile = resolve(outArg ?? join(VR_ROOT, 'vr-diff-report.html'));

if (!existsSync(resultsDir)) {
  console.error(`[vr-diff-report] results dir not found: ${resultsDir}`);
  console.error('  (run a VR pass first, or point at the ci-linux mirror)');
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────
/** Width/height straight out of the PNG IHDR chunk (no decode, no deps). */
function pngSize(buf) {
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );

/** Build one deviation record from a result dir, or null if it has no images. */
function makeGroup(dir) {
  const files = readdirSync(dir);
  const panes = {};
  let snap = null;
  for (const kind of KINDS) {
    const name = files.find((f) => f.endsWith(`-${kind}.png`));
    if (!name) continue;
    snap ??= name.replace(/-(expected|actual|diff)\.png$/, '');
    const buf = readFileSync(join(dir, name));
    panes[kind] = {
      uri: `data:image/png;base64,${buf.toString('base64')}`,
      size: pngSize(buf),
      kb: (buf.length / 1024).toFixed(1),
    };
  }
  if (!snap) return null;

  // `matrix-SwitchScreenshot-·-angular-chromium` → example + target.
  const dname = basename(dir).replace(/-chromium(-retry\d+)?$/, '');
  const parts = dname.split('-·-');
  const target = parts.length === 2 ? parts[1] : '';
  return { snap, target, panes };
}

/** Recursively gather canonical (non-retry) result dirs that hold images. */
function collect(root) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    const hasPng = entries.some(
      (e) => e.isFile() && /-(expected|actual|diff)\.png$/.test(e.name),
    );
    if (hasPng && !/-retry\d+$/.test(basename(d))) {
      const g = makeGroup(d);
      if (g) out.push(g);
    }
    for (const e of entries) if (e.isDirectory()) walk(join(d, e.name));
  };
  walk(root);
  // stable, human-friendly order: example then target
  out.sort(
    (a, b) => a.snap.localeCompare(b.snap) || a.target.localeCompare(b.target),
  );
  return out;
}

// ── render ────────────────────────────────────────────────────────────────────
function paneHtml(label, pane) {
  if (!pane) {
    return `<figure class="pane empty"><figcaption>${label}</figcaption><div class="missing">— none —</div></figure>`;
  }
  const dims = pane.size ? `${pane.size.w}×${pane.size.h}` : '';
  return `<figure class="pane">
      <figcaption>${label} <span class="meta">${dims} · ${pane.kb} KB</span></figcaption>
      <a href="${pane.uri}" target="_blank" rel="noopener" title="open full size">
        <span class="checker"><img loading="lazy" src="${pane.uri}" alt="${label}"></span>
      </a>
    </figure>`;
}

function cardHtml(g, i) {
  const title = g.target ? `${g.snap} · ${g.target}` : g.snap;
  const fade =
    g.panes.expected && g.panes.actual
      ? `<div class="fade">
        <div class="fadebox checker">
          <img src="${g.panes.expected.uri}" alt="expected">
          <img id="ov${i}" class="ov" src="${g.panes.actual.uri}" alt="actual" style="opacity:1">
        </div>
        <label class="slider">
          <span>expected</span>
          <input type="range" min="0" max="100" value="100"
                 oninput="document.getElementById('ov${i}').style.opacity=this.value/100;this.nextElementSibling.textContent=this.value>50?'actual':(this.value<50?'expected':'50/50')">
          <span>actual</span>
        </label>
      </div>`
      : '';
  return `<section class="card">
    <h2>${escapeHtml(title)}</h2>
    <div class="panes">
      ${paneHtml('Expected', g.panes.expected)}
      ${paneHtml('Actual', g.panes.actual)}
      ${paneHtml('Diff', g.panes.diff)}
    </div>
    ${fade}
  </section>`;
}

function render(groups) {
  const when = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const src = relative(process.cwd(), resultsDir) || resultsDir;
  const body =
    groups.length === 0
      ? `<p class="none">No screenshot deviations found in <code>${escapeHtml(src)}</code> 🎉</p>`
      : groups.map(cardHtml).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VR diff report — ${groups.length} deviation${groups.length === 1 ? '' : 's'}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#1a1a1a; --muted:#6b7280; --line:#e5e7eb; --card:#fafafa; --accent:#b45309; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f1115; --fg:#e6e6e6; --muted:#9aa0aa; --line:#272b33; --card:#161922; --accent:#f59e0b; } }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; z-index:2; padding:14px 20px; background:var(--bg); border-bottom:1px solid var(--line); }
  header h1 { margin:0; font-size:16px; }
  header .sub { color:var(--muted); font-size:12px; margin-top:2px; }
  header code { background:var(--card); padding:1px 5px; border-radius:4px; }
  main { padding:20px; max-width:1400px; margin:0 auto; }
  .none { color:var(--muted); font-size:15px; }
  .card { border:1px solid var(--line); border-radius:10px; background:var(--card); padding:14px 16px; margin-bottom:22px; }
  .card h2 { margin:0 0 12px; font-size:15px; font-weight:650; }
  .panes { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  @media (max-width:820px) { .panes { grid-template-columns:1fr; } }
  .pane { margin:0; }
  .pane figcaption { font-size:12px; font-weight:600; margin-bottom:6px; }
  .pane .meta { color:var(--muted); font-weight:400; }
  .pane.empty .missing { color:var(--muted); font-style:italic; padding:20px; border:1px dashed var(--line); border-radius:6px; text-align:center; }
  .checker { display:block; border:1px solid var(--line); border-radius:6px; overflow:auto;
    background-image:
      linear-gradient(45deg,#0000000d 25%,transparent 25%),
      linear-gradient(-45deg,#0000000d 25%,transparent 25%),
      linear-gradient(45deg,transparent 75%,#0000000d 75%),
      linear-gradient(-45deg,transparent 75%,#0000000d 75%);
    background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; }
  .checker img { display:block; max-width:100%; height:auto; }
  a { color:var(--accent); }
  .fade { margin-top:14px; }
  .fadebox { position:relative; max-width:520px; }
  .fadebox img { display:block; max-width:100%; }
  .fadebox .ov { position:absolute; inset:0; }
  .slider { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:12px; color:var(--muted); max-width:520px; }
  .slider input { flex:1; }
  .slider span:last-child { min-width:56px; font-weight:600; color:var(--fg); }
</style>
</head>
<body>
<header>
  <h1>Visual-regression diff report — ${groups.length} deviation${groups.length === 1 ? '' : 's'}</h1>
  <div class="sub">source <code>${escapeHtml(src)}</code> · generated ${when} · each row: Expected / Actual / Diff, plus an opacity fader (drag to cross-fade expected↔actual). Click any image for full size.</div>
</header>
<main>
${body}
</main>
</body>
</html>`;
}

// ── run ────────────────────────────────────────────────────────────────────
const groups = collect(resultsDir);
writeFileSync(outFile, render(groups), 'utf8');
console.log(
  `[vr-diff-report] ${groups.length} deviation(s) → ${relative(process.cwd(), outFile) || outFile}`,
);
for (const g of groups) console.log(`  · ${g.snap}${g.target ? ` · ${g.target}` : ''}`);

if (open && groups.length) {
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  spawn(cmd, [outFile], { stdio: 'ignore', detached: true }).unref();
}

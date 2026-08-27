// Spike 018 — build a side-by-side HTML view: .rozie source <-> generated virtual TS,
// with every mapped range highlighted and linked, plus live TS diagnostics.
// Hover a highlight on either side to see its partner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { generateVirtualTs } from './rozie-virtual-code.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** wrap [start,len) spans in <mark data-i>, non-overlapping, sorted */
function paint(text, spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = '', cur = 0;
  for (const s of sorted) {
    if (s.start < cur) continue;
    out += esc(text.slice(cur, s.start));
    out += `<mark class="m" data-i="${s.i}" title="chunk ${s.i}">${esc(text.slice(s.start, s.start + s.len))}</mark>`;
    cur = s.start + s.len;
  }
  return out + esc(text.slice(cur));
}

const panels = [];
for (const file of ['Probe.rozie', 'ProbeBad.rozie']) {
  const source = fs.readFileSync(path.join(HERE, file), 'utf8');
  const { code, mappings } = generateVirtualTs(source, file);
  const { sourceOffsets, generatedOffsets, lengths } = mappings[0];

  const srcSpans = sourceOffsets.map((start, i) => ({ start, len: lengths[i], i }));
  const genSpans = generatedOffsets.map((start, i) => ({ start, len: lengths[i], i }));

  panels.push(`
  <section>
    <h2>${file}</h2>
    <div class="grid">
      <div><h3>.rozie source</h3><pre>${paint(source, srcSpans)}</pre></div>
      <div><h3>generated virtual TypeScript</h3><pre>${paint(code, genSpans)}</pre></div>
    </div>
    <p class="meta">${lengths.length} mapped chunks &middot; ${source.length} B source &rarr; ${code.length} B virtual</p>
  </section>`);
}

// live diagnostics from the proof harness
let proof = '';
try {
  proof = execSync('node prove.mjs', { cwd: HERE, encoding: 'utf8' });
} catch (e) {
  proof = (e.stdout ?? '') + (e.stderr ?? '');
}

const html = `<!doctype html><meta charset="utf-8"><title>Spike 018 — .rozie virtual TypeScript</title>
<style>
  :root { --bg:#fff; --fg:#1a1a1a; --dim:#666; --line:#e2e2e2; --mark:#ffe9a8; --markb:#e0b83c; --panel:#fafafa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#161616; --fg:#e8e8e8; --dim:#999; --line:#333; --mark:#4a3c12; --markb:#a2842e; --panel:#1e1e1e; }
  }
  body { background:var(--bg); color:var(--fg); font:14px/1.5 ui-sans-serif,system-ui,sans-serif; margin:0; padding:2rem; }
  h1 { font-size:1.4rem; margin:0 0 .25rem; } h2 { font-size:1.05rem; margin:2rem 0 .5rem; }
  h3 { font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dim); margin:0 0 .4rem; font-weight:600; }
  .lede { color:var(--dim); max-width:70ch; margin:0 0 1rem; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  @media (max-width:900px) { .grid { grid-template-columns:1fr; } }
  pre { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:.75rem;
        overflow-x:auto; font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; margin:0; }
  mark.m { background:var(--mark); border-bottom:1px solid var(--markb); border-radius:2px; padding:0 1px; }
  mark.m.hot { background:var(--markb); color:#000; }
  .meta { color:var(--dim); font-size:.8rem; margin:.5rem 0 0; }
  .proof { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:1rem;
           white-space:pre-wrap; font:12px/1.6 ui-monospace,Menlo,monospace; overflow-x:auto; }
</style>
<h1>Spike 018 &mdash; <code>.rozie</code> &rarr; virtual TypeScript</h1>
<p class="lede">Highlighted ranges are Volar <code>CodeMapping</code> chunks: real source text carried into the
generated module, so TypeScript's answers map back to exact <code>.rozie</code> offsets. Unhighlighted text on the
right is synthesised (the <code>$props</code> interface, the ambient sigils). Hover any highlight to light up its
partner on the other side.</p>
${panels.join('\n')}
<h2>Proof harness output</h2>
<div class="proof">${esc(proof)}</div>
<script>
  const all = [...document.querySelectorAll('mark.m')];
  const set = (i, on) => all.filter(m => m.dataset.i === i).forEach(m => m.classList.toggle('hot', on));
  for (const m of all) {
    m.addEventListener('mouseenter', () => set(m.dataset.i, true));
    m.addEventListener('mouseleave', () => set(m.dataset.i, false));
  }
</script>`;

fs.writeFileSync(path.join(HERE, 'report.html'), html);
console.log('wrote report.html');

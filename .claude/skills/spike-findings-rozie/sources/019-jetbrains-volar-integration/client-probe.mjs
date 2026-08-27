// Spike 019 — drive the real LSP server over stdio, exactly as an editor would.
//
// This is the step BEFORE the IDE. If the server cannot answer hover/completion/
// definition/diagnostics over the wire here, no amount of IntelliJ wiring will
// help — and finding that out costs seconds instead of a 1.5 GB download plus a
// human IDE session.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'Probe.rozie');
const TRACE = path.join(HERE, 'lsp-trace.jsonl');

const source = fs.readFileSync(FIXTURE, 'utf8');
const uri = pathToFileURL(FIXTURE).toString();

// offset -> LSP {line, character}
const posOf = (off) => {
  const before = source.slice(0, off).split('\n');
  return { line: before.length - 1, character: before[before.length - 1].length };
};
const at = (needle, n = 1) => {
  let i = -1;
  for (let k = 0; k < n; k++) i = source.indexOf(needle, i + 1);
  if (i < 0) throw new Error(`fixture missing "${needle}" #${n}`);
  return i;
};

// ------------------------------------------------------------------ transport
const srv = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--stdio'], {
  cwd: HERE, stdio: ['pipe', 'pipe', 'pipe'],
});
const traceFd = fs.openSync(TRACE, 'w');
const trace = (dir, msg) => fs.writeSync(traceFd, JSON.stringify({ dir, t: Date.now(), msg }) + '\n');

srv.stderr.on('data', (d) => process.stderr.write(`[server stderr] ${d}`));

let nextId = 1;
const pending = new Map();
const notifications = [];

let buf = Buffer.alloc(0);
srv.stdout.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const headerEnd = buf.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const header = buf.subarray(0, headerEnd).toString('ascii');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) return;
    const len = Number(m[1]);
    const start = headerEnd + 4;
    if (buf.length < start + len) return;
    const body = buf.subarray(start, start + len).toString('utf8');
    buf = buf.subarray(start + len);
    let msg; try { msg = JSON.parse(body); } catch { continue; }
    trace('<<', msg);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id); pending.delete(msg.id); resolve(msg);
    } else if (msg.method) {
      notifications.push(msg);
      // server->client requests must be answered or the server stalls
      if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, result: null });
    }
  }
});

function send(msg) {
  trace('>>', msg);
  const s = JSON.stringify(msg);
  srv.stdin.write(`Content-Length: ${Buffer.byteLength(s, 'utf8')}\r\n\r\n${s}`);
}
function request(method, params, timeoutMs = 20000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve });
    setTimeout(() => { if (pending.delete(id)) reject(new Error(`timeout: ${method}`)); }, timeoutMs);
    send({ jsonrpc: '2.0', id, method, params });
  });
}
const notify = (method, params) => send({ jsonrpc: '2.0', method, params });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ assertions
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n        ${detail}` : ''}`); };
const hoverText = (r) => {
  const c = r?.result?.contents;
  if (!c) return '(none)';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(x => (typeof x === 'string' ? x : x.value)).join('\n');
  return c.value ?? JSON.stringify(c);
};

try {
  console.log('\n=== initialize ===');
  const init = await request('initialize', {
    processId: process.pid,
    rootUri: pathToFileURL(HERE).toString(),
    workspaceFolders: [{ uri: pathToFileURL(HERE).toString(), name: 'spike019' }],
    capabilities: {
      textDocument: {
        hover: { contentFormat: ['markdown', 'plaintext'] },
        completion: { completionItem: { snippetSupport: false } },
        definition: { linkSupport: false },
        publishDiagnostics: {},
      },
    },
    initializationOptions: {},
  });
  const caps = init.result?.capabilities ?? {};
  check('server advertises hoverProvider', !!caps.hoverProvider);
  check('server advertises completionProvider', !!caps.completionProvider);
  check('server advertises definitionProvider', !!caps.definitionProvider);

  notify('initialized', {});
  notify('textDocument/didOpen', {
    textDocument: { uri, languageId: 'rozie', version: 1, text: source },
  });
  await sleep(2500);   // let the TS project warm up

  console.log('\n=== hover ===');
  {
    const r = await request('textDocument/hover', {
      textDocument: { uri }, position: posOf(at('$props.label', 2) + 7),
    });
    const t = hoverText(r);
    check('hover on {{ $props.label }} reports string', /label\??:\s*string/.test(t), t.replace(/\n/g, ' ').slice(0, 120));
  }
  {
    const r = await request('textDocument/hover', {
      textDocument: { uri }, position: posOf(at('$data.clicks') + 6),
    });
    const t = hoverText(r);
    check('hover on $data.clicks reports number', /clicks:\s*number/.test(t), t.replace(/\n/g, ' ').slice(0, 120));
  }

  console.log('\n=== completion ===');
  {
    const r = await request('textDocument/completion', {
      textDocument: { uri }, position: posOf(at('$props.label', 2) + 7),
      context: { triggerKind: 1 },
    });
    const items = r.result?.items ?? r.result ?? [];
    const names = items.map(i => i.label).sort();
    check('completion after `$props.` offers the declared props',
      ['count', 'disabled', 'label'].every(n => names.includes(n)),
      `got ${names.length} item(s): ${names.slice(0, 12).join(', ')}`);
  }

  console.log('\n=== definition ===');
  {
    const r = await request('textDocument/definition', {
      textDocument: { uri }, position: posOf(at('$props.label', 2) + 7),
    });
    const locs = Array.isArray(r.result) ? r.result : r.result ? [r.result] : [];
    const l = locs[0];
    const line = l?.range?.start?.line ?? l?.targetRange?.start?.line;
    const sameFile = (l?.uri ?? l?.targetUri) === uri;
    check('go-to-definition lands inside <props> in the same file',
      sameFile && line !== undefined && line >= 1 && line <= 7,
      `uri match=${sameFile} line=${line} (props block = L1..L6, 0-based)`);
  }

  console.log('\n=== diagnostics (clean file must be silent) ===');
  {
    const pub = notifications.filter(n => n.method === 'textDocument/publishDiagnostics' && n.params?.uri === uri);
    const last = pub[pub.length - 1];
    const n = last?.params?.diagnostics?.length ?? 0;
    check('no false diagnostics on the clean fixture', n === 0,
      n ? last.params.diagnostics.map(d => d.message).join(' | ') : `(${pub.length} publishDiagnostics received)`);
  }
} catch (e) {
  console.log(`\n  ✗ FATAL: ${e.message}`);
  fail++;
} finally {
  try { await request('shutdown', null, 3000); notify('exit', null); } catch {}
  srv.kill();
  fs.closeSync(traceFd);
}

console.log(`\n${'='.repeat(62)}\n  ${pass} passed, ${fail} failed   ·   wire trace: lsp-trace.jsonl\n${'='.repeat(62)}\n`);
process.exit(fail === 0 ? 0 : 1);

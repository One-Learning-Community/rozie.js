/**
 * Phase 85 Task 1 — the wire test.
 *
 * Ported from the proven spike
 * (`.claude/skills/spike-findings-rozie/sources/019-jetbrains-volar-integration/client-probe.mjs`).
 * Drives the SHIPPED `dist-standalone/server-standalone.cjs` bundle — the
 * exact artifact both editors run — over real stdio, Content-Length-framed
 * JSON-RPC, exactly as an editor would. This is the step before an IDE: if
 * the server cannot answer over the wire here, no amount of editor wiring
 * will help.
 *
 * A wire trace is written next to the test output (`test-results/`,
 * gitignored) because it distinguishes a request that was never sent from
 * one that returned empty — those two failures look identical from the
 * assertion side.
 */
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, '../../..');
const SERVER_BUNDLE = path.join(PKG_ROOT, 'dist-standalone', 'server-standalone.cjs');
const FIXTURES_DIR = path.join(HERE, '..', 'fixtures');
const CLEAN_FIXTURE = path.join(FIXTURES_DIR, 'Probe.rozie');
const BAD_FIXTURE = path.join(FIXTURES_DIR, 'ProbeBad.rozie');
const TRACE_DIR = path.join(PKG_ROOT, 'test-results');
const TRACE_PATH = path.join(TRACE_DIR, 'wire.probe.trace.jsonl');

const cleanSource = readFileSync(CLEAN_FIXTURE, 'utf8');
const badSource = readFileSync(BAD_FIXTURE, 'utf8');
const cleanUri = pathToFileURL(CLEAN_FIXTURE).toString();
const badUri = pathToFileURL(BAD_FIXTURE).toString();

/** source offset -> LSP {line, character} */
function posOf(source: string, offset: number): { line: number; character: number } {
  const before = source.slice(0, offset).split('\n');
  return { line: before.length - 1, character: before[before.length - 1]?.length ?? 0 };
}

/** offset of the Nth occurrence of `needle` in `source` */
function at(source: string, needle: string, n = 1): number {
  let i = -1;
  for (let k = 0; k < n; k++) i = source.indexOf(needle, i + 1);
  if (i < 0) throw new Error(`fixture missing: "${needle}" (#${n})`);
  return i;
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
}

// biome-ignore lint/suspicious/noExplicitAny: LSP notification/result payloads are heterogeneous by design.
type AnyRecord = Record<string, any>;

describe('wire.probe — the standalone bundle, over real stdio', () => {
  let srv: ChildProcessWithoutNullStreams;
  let traceFd: number;
  let nextId = 1;
  const pending = new Map<number, { resolve: (msg: JsonRpcMessage) => void }>();
  const notifications: JsonRpcMessage[] = [];

  function trace(dir: '>>' | '<<', msg: unknown): void {
    writeSync(traceFd, `${JSON.stringify({ dir, t: Date.now(), msg })}\n`);
  }

  function send(msg: AnyRecord): void {
    trace('>>', msg);
    const s = JSON.stringify(msg);
    srv.stdin.write(`Content-Length: ${Buffer.byteLength(s, 'utf8')}\r\n\r\n${s}`);
  }

  function request(method: string, params: unknown, timeoutMs = 25000): Promise<JsonRpcMessage> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve });
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`timeout waiting for response to: ${method}`));
      }, timeoutMs);
      send({ jsonrpc: '2.0', id, method, params });
    });
  }

  function notify(method: string, params: unknown): void {
    send({ jsonrpc: '2.0', method, params });
  }

  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    expect(existsSync(SERVER_BUNDLE)).toBe(true);

    mkdirSync(TRACE_DIR, { recursive: true });
    traceFd = openSync(TRACE_PATH, 'w');

    srv = spawn(process.execPath, [SERVER_BUNDLE, '--stdio'], {
      cwd: PKG_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    srv.stderr.on('data', (d: Buffer) => trace('<<', { stderr: d.toString() }));

    let buf = Buffer.alloc(0);
    srv.stdout.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const headerEnd = buf.indexOf('\r\n\r\n');
        if (headerEnd < 0) return;
        const header = buf.subarray(0, headerEnd).toString('ascii');
        const m = /Content-Length:\s*(\d+)/i.exec(header);
        if (!m?.[1]) return;
        const len = Number(m[1]);
        const start = headerEnd + 4;
        if (buf.length < start + len) return;
        const body = buf.subarray(start, start + len).toString('utf8');
        buf = buf.subarray(start + len);
        let msg: JsonRpcMessage;
        try {
          msg = JSON.parse(body);
        } catch {
          continue;
        }
        trace('<<', msg);
        if (msg.id !== undefined && pending.has(msg.id)) {
          const entry = pending.get(msg.id);
          pending.delete(msg.id);
          entry?.resolve(msg);
        } else if (msg.method) {
          notifications.push(msg);
          // server-to-client requests must be answered or the server stalls.
          if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, result: null });
        }
      }
    });

    await request('initialize', {
      processId: process.pid,
      rootUri: pathToFileURL(FIXTURES_DIR).toString(),
      workspaceFolders: [{ uri: pathToFileURL(FIXTURES_DIR).toString(), name: 'wire-probe' }],
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
    notify('initialized', {});

    notify('textDocument/didOpen', {
      textDocument: { uri: cleanUri, languageId: 'rozie', version: 1, text: cleanSource },
    });
    notify('textDocument/didOpen', {
      textDocument: { uri: badUri, languageId: 'rozie', version: 1, text: badSource },
    });

    // Let the TS project warm up (tsconfig discovery + Program construction).
    await sleep(3000);
  }, 30000);

  afterAll(async () => {
    try {
      await request('shutdown', null, 3000);
      notify('exit', null);
    } catch {
      // best-effort — the process is killed unconditionally below.
    }
    srv?.kill();
    if (traceFd !== undefined) closeSync(traceFd);
  });

  it('(1) hover at the caret inside {{ $props.label }} reports a type matching label?: string', async () => {
    const r = await request('textDocument/hover', {
      textDocument: { uri: cleanUri },
      position: posOf(cleanSource, at(cleanSource, '$props.label', 2) + 7),
    });
    const contents = (r.result as AnyRecord | null)?.contents;
    const text = Array.isArray(contents)
      ? contents.map((c: AnyRecord | string) => (typeof c === 'string' ? c : c.value)).join('\n')
      : typeof contents === 'string'
        ? contents
        : (contents?.value ?? JSON.stringify(contents));
    expect(text, `hover text: ${text}`).toMatch(/label\??:\s*string/);
  });

  it('(2) textDocument/definition at that same caret lands inside the <props> block, same file', async () => {
    const r = await request('textDocument/definition', {
      textDocument: { uri: cleanUri },
      position: posOf(cleanSource, at(cleanSource, '$props.label', 2) + 7),
    });
    const result = r.result as AnyRecord | AnyRecord[] | null;
    const locs = Array.isArray(result) ? result : result ? [result] : [];
    const loc = locs[0];
    const line: number | undefined = loc?.range?.start?.line ?? loc?.targetRange?.start?.line;
    const sameFile = (loc?.uri ?? loc?.targetUri) === cleanUri;
    // <props> spans source lines 2..7 (1-based) — 0-based line 1..6.
    expect(sameFile, `same-file definition: ${JSON.stringify(loc)}`).toBe(true);
    expect(line, `definition line: ${JSON.stringify(loc)}`).toBeGreaterThanOrEqual(1);
    expect(line, `definition line: ${JSON.stringify(loc)}`).toBeLessThanOrEqual(6);
  });

  it('(3) Probe.rozie publishes zero diagnostics — no false errors from either half', async () => {
    await sleep(500);
    const published = notifications.filter(
      (n) => n.method === 'textDocument/publishDiagnostics' && (n.params as AnyRecord)?.uri === cleanUri,
    );
    const last = published[published.length - 1];
    const diagnostics: AnyRecord[] = (last?.params as AnyRecord)?.diagnostics ?? [];
    expect(diagnostics, `diagnostics: ${JSON.stringify(diagnostics)}`).toHaveLength(0);
  });

  it('(4) ProbeBad.rozie publishes a TypeScript error AND a ROZ diagnostic, both at correct ranges', async () => {
    await sleep(500);
    const published = notifications.filter(
      (n) => n.method === 'textDocument/publishDiagnostics' && (n.params as AnyRecord)?.uri === badUri,
    );
    const last = published[published.length - 1];
    const diagnostics: AnyRecord[] = (last?.params as AnyRecord)?.diagnostics ?? [];

    const isTsDiag = (d: AnyRecord): boolean => d.source === 'ts' || typeof d.code === 'number';
    const tsDiag = diagnostics.find((d) => isTsDiag(d) && String(d.message ?? '').includes('bogus'));
    expect(
      tsDiag,
      `no TypeScript diagnostic mentioning "bogus" found in: ${JSON.stringify(diagnostics)}`,
    ).toBeTruthy();
    if (tsDiag) {
      const bogusPos = posOf(badSource, at(badSource, 'bogus'));
      expect(tsDiag.range?.start?.line, `mapped range: ${JSON.stringify(tsDiag.range)}`).toBe(bogusPos.line);
    }

    const rozDiag = diagnostics.find((d) => d.source === 'rozie' || String(d.code ?? '').startsWith('ROZ'));
    expect(rozDiag, `no ROZ diagnostic found in: ${JSON.stringify(diagnostics)}`).toBeTruthy();
  });
});

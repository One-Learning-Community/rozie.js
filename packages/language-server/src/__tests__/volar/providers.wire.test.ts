/**
 * Phase 85 Plan 02 — the wire test for the six providers this plan restores
 * (hover, document symbols, definition, references, completion, rename)
 * plus a fresh diagnostics check on the cross-file fixture pair.
 *
 * Drives the SHIPPED `dist-standalone/server-standalone.cjs` bundle over real
 * stdio (Content-Length-framed JSON-RPC) — the exact artifact both editors
 * run — exactly as Plan 85-01's `wire.probe.test.ts` does. This file uses a
 * DIFFERENT fixture pair (`ProbeConsumer.rozie` / `ProbeProducer.rozie`,
 * Task 1) specifically because a single-file fixture cannot exercise
 * `readDoc`'s cross-file resolution — the composed-component hover,
 * cross-file definition, and slot-fill definition assertions below all
 * depend on the consumer resolving the producer through the read hook
 * (`featureContext.ts`).
 *
 * A wire trace is written next to test output for the same reason
 * `wire.probe.test.ts` writes one: it separates a request that was never
 * sent from one that was sent and returned empty, which look identical from
 * the assertion side.
 *
 * Task 1 (this commit): hover, document symbols.
 * Task 2 (85-02): definition, references, completion.
 * Task 3 (85-02): prepare-rename, rename, diagnostics.
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
const PRODUCER_FIXTURE = path.join(FIXTURES_DIR, 'ProbeProducer.rozie');
const CONSUMER_FIXTURE = path.join(FIXTURES_DIR, 'ProbeConsumer.rozie');
const TRACE_DIR = path.join(PKG_ROOT, 'test-results');
const TRACE_PATH = path.join(TRACE_DIR, 'providers.wire.trace.jsonl');

const producerSource = readFileSync(PRODUCER_FIXTURE, 'utf8');
const consumerSource = readFileSync(CONSUMER_FIXTURE, 'utf8');
const producerUri = pathToFileURL(PRODUCER_FIXTURE).toString();
const consumerUri = pathToFileURL(CONSUMER_FIXTURE).toString();

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

/** The `$props.title` member offset shared by hover/definition/references/completion below. */
const propsTitleUsageOffset = at(producerSource, '$props.title') + '$props.'.length;
/** The declaration-site offset of the `title` key inside `<props>` (first occurrence). */
const propsTitleDeclOffset = at(producerSource, 'title', 1);
/** The `<ProbeProducer>` opening tag's NAME offset (right after `<`). */
const consumerTagNameOffset = at(consumerSource, '<ProbeProducer') + 1;
/** The `#header` slot-fill token offset in the consumer's template. */
const consumerSlotFillOffset = at(consumerSource, '#header');

describe('providers.wire — Volar-composed ROZ plugins over real stdio', () => {
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
      workspaceFolders: [{ uri: pathToFileURL(FIXTURES_DIR).toString(), name: 'providers-wire' }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ['markdown', 'plaintext'] },
          completion: { completionItem: { snippetSupport: false } },
          definition: { linkSupport: true },
          references: {},
          rename: { prepareSupport: true },
          documentSymbol: {},
          publishDiagnostics: {},
        },
      },
      initializationOptions: {},
    });
    notify('initialized', {});

    notify('textDocument/didOpen', {
      textDocument: { uri: producerUri, languageId: 'rozie', version: 1, text: producerSource },
    });
    notify('textDocument/didOpen', {
      textDocument: { uri: consumerUri, languageId: 'rozie', version: 1, text: consumerSource },
    });

    // Let the TS project warm up (tsconfig discovery + Program construction).
    await sleep(4000);
  }, 40000);

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

  function hoverText(result: unknown): string {
    const contents = (result as AnyRecord | null)?.contents;
    if (!contents) return '(none)';
    if (Array.isArray(contents)) {
      return contents.map((c: AnyRecord | string) => (typeof c === 'string' ? c : c.value)).join('\n');
    }
    return typeof contents === 'string' ? contents : (contents?.value ?? JSON.stringify(contents));
  }

  it('(1) hover on a props-sigil member returns BOTH the Rozie signature and a TypeScript type', async () => {
    const r = await request('textDocument/hover', {
      textDocument: { uri: producerUri },
      position: posOf(producerSource, propsTitleUsageOffset),
    });
    const text = hoverText(r.result);
    expect(text, `hover text: ${text}`).toMatch(/\$props\.title:\s*String/);
    expect(text, `hover text: ${text}`).toMatch(/title\??:\s*string/);
  });

  it('(2) hover on a composed-component tag returns the resolved producer path', async () => {
    const r = await request('textDocument/hover', {
      textDocument: { uri: consumerUri },
      position: posOf(consumerSource, consumerTagNameOffset),
    });
    const text = hoverText(r.result);
    expect(text, `hover text: ${text}`).toMatch(/ProbeProducer/);
    expect(text, `hover text: ${text}`).toMatch(/\.\/ProbeProducer\.rozie/);
  });

  it('(3) document symbols return the SFC block outline at correct .rozie ranges', async () => {
    const r = await request('textDocument/documentSymbol', {
      textDocument: { uri: producerUri },
    });
    const symbols = (r.result as AnyRecord[] | null) ?? [];
    expect(symbols, `symbols: ${JSON.stringify(symbols)}`).toHaveLength(1);
    const root = symbols[0];
    expect(root?.name).toBe('ProbeProducer');
    const propsBlock = root?.children?.find((c: AnyRecord) => c.name === 'props');
    expect(propsBlock, `children: ${JSON.stringify(root?.children)}`).toBeTruthy();
    const titleSymbol = propsBlock?.children?.find((c: AnyRecord) => c.name === 'title');
    expect(titleSymbol, `props children: ${JSON.stringify(propsBlock?.children)}`).toBeTruthy();
    // <props> key `title` is on source line 4 (0-based) — see ProbeProducer.rozie.
    expect(titleSymbol?.range?.start?.line).toBe(4);
  });
});

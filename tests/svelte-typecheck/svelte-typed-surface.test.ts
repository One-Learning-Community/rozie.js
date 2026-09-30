/**
 * SVELTE-TYPED-SURFACE — typed public surface phase 1 (Task 12).
 *
 * Compiles examples/TypedEvents.rozie to a Svelte component, then svelte-checks:
 *   - the component itself (`<types>` names in `<script module>` must resolve in
 *     the instance script, no TS2304; the untyped rest-arg `jump(...a)` must
 *     accept the typed `jump(to: number): void` overload, no TS2394/TS2322), and
 *   - a typed consumer (payloads, no-payload event, slot ctx, handle, importable
 *     `<types>` names) — plus separate expected-fail runs with matched messages.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { emitSvelteTypes } from '@rozie/target-svelte';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC = readFileSync(resolve(ROOT, 'examples/TypedEvents.rozie'), 'utf8');

const CONSUMER = `<script lang="ts">
  import TypedEvents, { type PingPayload, type Count } from './TypedEvents.svelte';
  let inst: ReturnType<typeof TypedEvents> | undefined = $state();
  const n: number | undefined = inst?.getCount();
  inst?.jump(3);
  inst?.clear('anything');
  inst?.getCount().toFixed();
  const c0: Count = 1;
  function onPing(p: PingPayload) { return p.count.toFixed(); }
  void n; void c0;
</script>

<TypedEvents tone="info" onping={onPing} onreset={() => {}} onselect={(v) => v.toFixed()} onrowopen={(r) => r.index.toFixed()} bind:this={inst}>
  {#snippet row({ count, tone })}{count.toFixed()}{tone}{(count satisfies Count)}{/snippet}
</TypedEvents>
`;

// Each negative must fail for the RIGHT reason: matched against svelte-check output.
const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'payload field that does not exist',
    markup: `<TypedEvents onping={(p) => p.nope} />`,
    match: /Property 'nope' does not exist on type 'PingPayload'/,
  },
  {
    name: 'no-payload event handler requiring an argument',
    markup: `<TypedEvents onreset={(x: number) => x} />`,
    match: /Type '\(x: number\) => number' is not assignable to type '\(\) => void'/,
  },
  {
    name: 'slot tone (string) assigned to number',
    markup: `<TypedEvents>{#snippet row({ tone })}{(tone satisfies number)}{/snippet}</TypedEvents>`,
    match: /Type 'string' does not satisfy the expected type 'number'/,
  },
  {
    name: 'handle bump() takes no arguments',
    script: `let inst: ReturnType<typeof TypedEvents> | undefined = $state();\n  inst?.bump(1);`,
    markup: `<TypedEvents bind:this={inst} />`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'handle jump() requires a number',
    script: `let inst: ReturnType<typeof TypedEvents> | undefined = $state();\n  inst?.jump('x');`,
    markup: `<TypedEvents bind:this={inst} />`,
    match: /Argument of type 'string' is not assignable to parameter of type 'number'/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-typed-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(
        resolve(HERE, 'node_modules/.bin/svelte-check'),
        ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'],
        { cwd: tmpDir, stdio: 'pipe' },
      );
      return { threw: false, output: '' };
    } catch (err) {
      return {
        threw: true,
        output:
          ((err as { stdout?: Buffer }).stdout?.toString() ?? '') +
          ((err as { stderr?: Buffer }).stderr?.toString() ?? ''),
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function compiled(): string {
  const result = compile(SRC, { target: 'svelte', filename: 'TypedEvents.rozie', sourceMap: false });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

describe('SVELTE-TYPED-SURFACE — typed emits / <types> module block / typed handle', () => {
  const svelte = compiled();

  it('places <types> in a <script module> before the instance script', () => {
    expect(svelte.indexOf('<script module lang="ts">')).toBeGreaterThanOrEqual(0);
    expect(svelte.indexOf('<script module lang="ts">')).toBeLessThan(svelte.indexOf('<script lang="ts">'));
    expect(svelte).toMatch(/export function jump\(to: number\): void;/);
    expect(svelte).toMatch(/onping\?: \(payload: PingPayload\) => void;/);
    expect(svelte).toMatch(/onreset\?: \(\) => void;/);
  });

  it('the component itself svelte-checks clean (no TS2304 for <types> names, no TS2394 for the jump overload)', () => {
    const r = svelteCheck({ 'TypedEvents.svelte': svelte });
    expect(r.output).not.toMatch(/TS2304|Cannot find name/);
    expect(r.output).not.toMatch(/TS2394|TS2322/);
    expect(r.threw, r.output).toBe(false);
  });

  it('typed consumer (payload, no-payload, slot ctx, handle, <types> names) is svelte-check clean', () => {
    const r = svelteCheck({ 'TypedEvents.svelte': svelte, 'Consumer.svelte': CONSUMER });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import TypedEvents from './TypedEvents.svelte';\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck({ 'TypedEvents.svelte': svelte, 'Consumer.svelte': consumer });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }

  it('sidecar: .d.rozie.ts exports <types> and types the handler props', () => {
    const { ast } = parse(SRC, { filename: 'TypedEvents.rozie' });
    if (!ast) throw new Error('parse() null');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() null');
    const dts = emitSvelteTypes(ir);
    expect(dts).toMatch(/export interface PingPayload/);
    expect(dts).toMatch(/onping\?: \(payload: PingPayload\) => void;/);
    const consumer = `import type TypedEvents from './TypedEventsSidecar';
import type { PingPayload, Count } from './TypedEventsSidecar';
import type { ComponentProps } from 'svelte';
export const ok: ComponentProps<typeof TypedEvents> = { onping: (p: PingPayload) => p.count.toFixed() };
// @ts-expect-error — payload has no 'nope'
export const bad: ComponentProps<typeof TypedEvents> = { onping: (p) => p.nope };
export const c0: Count = 1;
`;
    const r = svelteCheck({ 'TypedEventsSidecar.d.ts': dts, 'consumer.ts': consumer });
    expect(r.threw, r.output).toBe(false);
  });
});

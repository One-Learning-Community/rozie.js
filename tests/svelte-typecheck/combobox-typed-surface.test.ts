/**
 * SVELTE-COMBOBOX-TYPED-SURFACE — typed public surface (release-0.8.0 token-input wave).
 * svelte-check over compile(Combobox.rozie): `onsearch` / `onchange` / `oncreate`
 * payloads typed, snippet ctx typed, token-input props accepted, handle verbs
 * typed (incl. `activeOption`). Negatives pinned to the specific message.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
// Absolute filename: the <components> Popover specifier resolves via node_modules UPWARD from it.
const SRC_PATH = resolve(ROOT, 'packages/ui/combobox/src/Combobox.rozie');
const SRC = readFileSync(SRC_PATH, 'utf8');

/** Stub the vendored runtime helper (not part of the combobox surface). */
function stubInternals(code: string): string {
  return code.replace(/^import \{ groupOptions \} from '\.\/internal\/groupOptions';$/m, 'const groupOptions: any = undefined;');
}

/**
 * Ambient shims for the composed popover leaf + windowing engine, which this
 * harness does not install (an import-preserving shim keeps the SFC/module
 * shape intact — replacing an import with a `const` would push the remaining
 * `<script setup>` imports out of module position).
 */
const SHIMS = `declare module '@rozie-ui/popover-vue' { const C: any; export default C; }
declare module '@rozie-ui/popover-svelte' { const C: any; export default C; }
declare module '@rozie-ui/popover-angular' { export const Popover: any; }
declare module '@tanstack/virtual-core' { export const Virtualizer: any, elementScroll: any, observeElementRect: any, observeElementOffset: any, measureElement: any; }
`;

/**
 * CONSUMER-surface gate: only diagnostics in the consumer file count. The
 * emitted combobox body carries pre-existing strict-mode body errors (implicit
 * any / never[] inference in r-for rows and block builders) that are not part of
 * the typed public surface (no cosmetic tsc on emitted bodies).
 */
function consumerErrors(out: string, file: string): string {
  return out.split('\n').filter((l) => l.includes(file) && /error/i.test(l)).join('\n');
}


const OK = `<script lang="ts">
  import Combobox, { type ComboboxSearchPayload, type ComboboxChangePayload, type ComboboxCreatePayload, type ComboboxChipSlotCtx, type ComboboxOptionSlotCtx, type ComboboxQuerySlotCtx, type ComboboxGroupHeadingSlotCtx, type ComboboxGroupMoreSlotCtx, type ComboboxGroup } from './Combobox.svelte';
  let inst: ReturnType<typeof Combobox> | undefined = $state();
  let to: string[] = $state([]);
  const picked: any = inst?.activeOption();
  inst?.seedQuery('x');
  inst?.pinOpen(true);
  void picked;
  const isEmail = (text: string): boolean => text.includes('@');
const cp = {} as ComboboxChangePayload; const cs: boolean = cp.selected; const ct: string | undefined = cp.text;
const sp = {} as ComboboxSearchPayload; const sq: string = sp.query;
const crp = {} as ComboboxCreatePayload; const crq: string = crp.query;
const chip = {} as ComboboxChipSlotCtx; const chi: number = chip.index;
const oc = {} as ComboboxOptionSlotCtx; const ob: boolean = oc.active && oc.selected && oc.disabled;
const qc = {} as ComboboxQuerySlotCtx; const qq: string = qc.query;
const gh = {} as ComboboxGroupHeadingSlotCtx; const g: ComboboxGroup = gh.group;
const gm = {} as ComboboxGroupMoreSlotCtx; const gmh: number = gm.hidden;
void cs; void ct; void sq; void crq; void chi; void ob; void qq; void g; void gmh;
</script>

<Combobox bind:this={inst} bind:value={to} multiple block chipLayout="inline" disableOpenOnFocus hideEmpty delimiters={[',', ';']} validate={isEmail} selectOnTab
  onsearch={(p) => { const q: string = p.query; void q; }}
  onchange={(p) => { const s: boolean = p.selected; const t: string | undefined = p.text; void s; void t; }}
  oncreate={(p) => { const q: string = p.query; void q; }}>
  {#snippet chip({ option, remove, index })}{(index satisfies number)}{void remove()}{void option}{/snippet}
  {#snippet option({ index, active, selected, disabled })}{(index satisfies number)}{(active satisfies boolean)}{(selected satisfies boolean)}{(disabled satisfies boolean)}{/snippet}
  {#snippet empty({ query })}{(query satisfies string)}{/snippet}
  {#snippet create({ query })}{(query satisfies string)}{/snippet}
  {#snippet groupHeading({ group })}{(group.id satisfies string)}{(group.label satisfies string)}{/snippet}
  {#snippet groupMore({ group, hidden, expand })}{(hidden satisfies number)}{void expand()}{group?.label}{/snippet}
</Combobox>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  { name: 'change payload selected is boolean', markup: `<Combobox onchange={(p) => p.selected.toUpperCase()} />`, match: /Property 'toUpperCase' does not exist on type 'boolean'/ },
  { name: 'search payload query is string', markup: `<Combobox onsearch={(p) => p.query.toPrecision()} />`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  { name: 'change payload text is string | undefined', script: `const cp = {} as ComboboxChangePayload;\n  const n: number = cp.text;\n  void n;`, markup: `<Combobox />`, match: /Type 'string( \| undefined)?' is not assignable to type 'number'/ },
  { name: 'chip snippet index is number', markup: `<Combobox>{#snippet chip({ index })}{index.toUpperCase()}{/snippet}</Combobox>`, match: /Property 'toUpperCase' does not exist on type 'number'/ },
  { name: 'handle seedQuery takes a string', script: `let inst: ReturnType<typeof Combobox> | undefined = $state();\n  inst?.seedQuery(1);`, markup: `<Combobox bind:this={inst} />`, match: /Argument of type 'number' is not assignable to parameter of type 'string'/ },
  { name: 'unknown handle verb rejected', script: `let inst: ReturnType<typeof Combobox> | undefined = $state();\n  inst?.openList();`, markup: `<Combobox bind:this={inst} />`, match: /Property 'openList' does not exist/ },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-combobox-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/svelte-check'), ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'machine'], { cwd: tmpDir, stdio: 'pipe' });
      return { threw: false, output: '' };
    } catch (err) {
      return {
        threw: true,
        output: ((err as { stdout?: Buffer }).stdout?.toString() ?? '') + ((err as { stderr?: Buffer }).stderr?.toString() ?? ''),
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('SVELTE-COMBOBOX-TYPED-SURFACE — typed payloads, snippet ctx, token-input props, typed handle', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: SRC_PATH, sourceMap: false });
  const svelte = stubInternals(r0.code);

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck({ 'shims.d.ts': SHIMS, 'Combobox.svelte': svelte, 'Consumer.svelte': OK });
    expect(consumerErrors(r.output, 'Consumer.svelte'), r.output).toBe('');
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import Combobox, { type ComboboxChangePayload } from './Combobox.svelte';\n  void (null as ComboboxChangePayload | null);\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck({ 'shims.d.ts': SHIMS, 'Combobox.svelte': svelte, 'Consumer.svelte': consumer });
      const mine = consumerErrors(r.output, 'Consumer.svelte');
      expect(r.threw).toBe(true);
      expect(mine).toMatch(neg.match);
      expect(mine).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }
});

/**
 * SVELTE-PAGINATION-TYPED-SURFACE — the Svelte half of the consumer-side
 * typed-surface gate (quick 261018-vdu). svelte-checks compile(Pagination.rozie):
 * `bind:modelValue` is a number, `onchange` receives a `PaginationChangePayload`,
 * the four snippets' params are typed and the handle verbs are typed. Negatives
 * are pinned to the specific svelte-check message (no vacuous passes).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/Pagination.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/pagination/src/internal/paginationItems.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/paginationItems'", "'./paginationItems'");

const OK = `<script lang="ts">
  import Pagination, { type PaginationChangePayload } from './Pagination.svelte';
  let inst: ReturnType<typeof Pagination> | undefined = $state();
  let page = $state(1);
  inst?.goto(3);
  inst?.next();
  inst?.prev();
  inst?.first();
  inst?.last();
  function onchange(p: PaginationChangePayload) { const n: number = p.page; void n; }
</script>

<Pagination bind:this={inst} bind:modelValue={page} total={195} pageSize={10} siblingCount={2} boundaryCount={1} disabled={false} ariaLabel="Pages" {onchange} class="c">
  {#snippet item({ page: p, selected, goto })}{((p + 1) satisfies number)}{(selected satisfies boolean)}{void goto()}{/snippet}
  {#snippet ellipsis({ index })}{((index + 1) satisfies number)}{/snippet}
  {#snippet prevControl({ disabled, goto, page: p })}{(disabled satisfies boolean)}{((p + 1) satisfies number)}{void goto()}{/snippet}
  {#snippet nextControl({ disabled, goto, page: p })}{(disabled satisfies boolean)}{((p + 1) satisfies number)}{void goto()}{/snippet}
</Pagination>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'bind:modelValue is a number, not a string',
    markup: `<Pagination bind:modelValue={label} />`,
    script: `let label = $state('x');`,
    match: /Type 'string' is not assignable to type 'number/,
  },
  {
    name: 'onchange payload page is a number',
    markup: `<Pagination onchange={(p) => p.page.toUpperCase()} />`,
    match: /Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item snippet page is a number',
    markup: `<Pagination>{#snippet item({ page })}{page.toUpperCase()}{/snippet}</Pagination>`,
    match: /Property 'toUpperCase' does not exist on type 'number'/,
  },
  {
    name: 'item snippet goto takes no arguments',
    markup: `<Pagination>{#snippet item({ goto })}{goto(1)}{/snippet}</Pagination>`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'handle goto() takes a number',
    script: `let inst: ReturnType<typeof Pagination> | undefined = $state();\n  inst?.goto('3');`,
    markup: `<Pagination bind:this={inst} />`,
    match: /Argument of type 'string' is not assignable to parameter of type 'number'/,
  },
  {
    name: 'handle next() takes no arguments',
    script: `let inst: ReturnType<typeof Pagination> | undefined = $state();\n  inst?.next(1);`,
    markup: `<Pagination bind:this={inst} />`,
    match: /Expected 0 arguments, but got 1/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-pagination-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/svelte-check'), ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'human'], { cwd: tmpDir, stdio: 'pipe' });
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

describe('SVELTE-PAGINATION-TYPED-SURFACE — typed onchange payload, snippet params, typed handle', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: 'Pagination.rozie', sourceMap: false });
  const svelte = flatten(r0.code);
  const files = (consumer: string) => ({ 'Pagination.svelte': svelte, 'paginationItems.ts': HELPER, 'Consumer.svelte': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck(files(OK));
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import Pagination from './Pagination.svelte';\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck(files(consumer));
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }
});

/**
 * SVELTE-DIALOG-TYPED-SURFACE — the Svelte half of the consumer-side typed-surface
 * gate (quick 261018-vdu). svelte-checks compile(Dialog.rozie): `bind:open` is
 * boolean, `onclose` receives a `DialogClosePayload`, props are typed and the
 * handle verbs take no arguments. Negatives are pinned to the specific
 * svelte-check message (no vacuous passes).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/Dialog.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/internal/scrollLock.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/scrollLock'", "'./scrollLock'");

const OK = `<script lang="ts">
  import Dialog, { type DialogClosePayload, type DialogCloseReason } from './Dialog.svelte';
  let inst: ReturnType<typeof Dialog> | undefined = $state();
  let isOpen = $state(false);
  inst?.show();
  inst?.hide();
  function onclose(p: DialogClosePayload) { const r: DialogCloseReason = p.reason; void r; }
</script>

<Dialog bind:this={inst} bind:open={isOpen} ariaLabel="x" ariaLabelledby="t" initialFocus="#a" disableBackdropClose {onclose} class="c">
  <p>hi</p>
</Dialog>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'bind:open is boolean, not number',
    markup: `<Dialog bind:open={count} />`,
    script: `let count = $state(0);`,
    match: /Type 'number' is not assignable to type 'boolean/,
  },
  {
    name: 'onclose payload reason is a DialogCloseReason',
    markup: `<Dialog onclose={(p) => p.reason.toExponential()} />`,
    match: /Property 'toExponential' does not exist on type 'DialogCloseReason'/,
  },
  {
    name: 'handle show() takes no arguments',
    script: `let inst: ReturnType<typeof Dialog> | undefined = $state();\n  inst?.show(1);`,
    markup: `<Dialog bind:this={inst} />`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'initialFocus rejects a number',
    markup: `<Dialog initialFocus={5} />`,
    match: /Type 'number' is not assignable to type/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-dialog-'));
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

describe('SVELTE-DIALOG-TYPED-SURFACE — bind:open boolean, typed onclose payload, typed handle', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: 'Dialog.rozie', sourceMap: false });
  const svelte = flatten(r0.code);
  const files = (consumer: string) => ({ 'Dialog.svelte': svelte, 'scrollLock.ts': HELPER, 'Consumer.svelte': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck(files(OK));
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import Dialog from './Dialog.svelte';\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck(files(consumer));
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }
});

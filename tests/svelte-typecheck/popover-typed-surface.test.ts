/**
 * SVELTE-POPOVER-TYPED-SURFACE — typed public surface phase 1 (Task 17).
 * svelte-checks compile(Popover.rozie): `bind:open` is boolean (the `open`
 * model is the only change signal — the separate `change` emit was removed,
 * release-0.8.0 audit B6), the
 * `anchor` snippet ctx is typed, handle verbs are typed. Negatives are pinned
 * to the specific svelte-check message.
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/popover/src/Popover.rozie'), 'utf8');

function stubInternals(code: string): string {
  return code
    .replace(
      /^import \{[^}]*\} from '@floating-ui\/dom';$/m,
      'const computePosition: any = undefined, autoUpdate: any = undefined, offsetMiddleware: any = undefined, flip: any = undefined, shift: any = undefined, arrowMiddleware: any = undefined, size: any = undefined;',
    )
    .replace(/^import \{ buildMiddleware \} from '\.\/internal\/middleware';$/m, 'const buildMiddleware: any = undefined;');
}

const OK = `<script lang="ts">
  import Popover from './Popover.svelte';
  let inst: ReturnType<typeof Popover> | undefined = $state();
  let isOpen = $state(false);
  inst?.show();
  inst?.hide();
  inst?.toggle();
  inst?.reposition();
</script>

<Popover bind:this={inst} bind:open={isOpen}>
  {#snippet anchor({ open, toggle, show, hide, panelId })}{(open satisfies boolean)}{(panelId satisfies string)}{void toggle()}{void show()}{void hide()}{/snippet}
</Popover>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'bind:open is boolean, not number',
    markup: `<Popover bind:open={count} />`,
    script: `let count = $state(0);`,
    match: /Type 'number' is not assignable to type 'boolean/,
  },
  {
    name: 'anchor snippet open is boolean',
    markup: `<Popover>{#snippet anchor({ open })}{open.toFixed()}{/snippet}</Popover>`,
    match: /Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'handle show() takes no arguments',
    script: `let inst: ReturnType<typeof Popover> | undefined = $state();\n  inst?.show(1);`,
    markup: `<Popover bind:this={inst} />`,
    match: /Expected 0 arguments, but got 1/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-popover-'));
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

describe('SVELTE-POPOVER-TYPED-SURFACE — bind:open: boolean, typed anchor ctx, typed handle', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: 'Popover.rozie', sourceMap: false });
  const svelte = stubInternals(r0.code);

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck({ 'Popover.svelte': svelte, 'Consumer.svelte': OK });
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import Popover from './Popover.svelte';\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck({ 'Popover.svelte': svelte, 'Consumer.svelte': consumer });
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }
});

/**
 * SVELTE-TEXT-FIELD-TYPED-SURFACE — the Svelte half of the consumer-side
 * typed-surface gate for `@rozie-ui/text-field` (mirrors
 * dialog-typed-surface.test.ts). svelte-checks compile(TextField.rozie):
 * `bind:modelValue` is string, `onchange` / `onenter` receive a
 * `TextFieldValuePayload`, props are typed and the exposed verbs
 * (focus / select / clear) take no arguments. Negatives are pinned to the
 * specific svelte-check message (no vacuous passes).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/TextField.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/internal/autosize.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/autosize'", "'./autosize'");

const OK = `<script lang="ts">
  import TextField, { type TextFieldValuePayload } from './TextField.svelte';
  let inst: ReturnType<typeof TextField> | undefined = $state();
  let text = $state('');
  inst?.focus();
  inst?.select();
  inst?.clear();
  function onchange(p: TextFieldValuePayload) { const v: string = p.value; void v; }
  function onenter(p: TextFieldValuePayload) { const v: string = p.value; void v; }
</script>

{#snippet prefix()}<span>$</span>{/snippet}
{#snippet suffix()}<span>kg</span>{/snippet}

<TextField
  bind:this={inst}
  bind:modelValue={text}
  label="Email"
  description="d"
  error=""
  invalid
  type="email"
  placeholder="p"
  name="n"
  autocomplete="email"
  required
  disabled={false}
  readonly={false}
  maxLength={10}
  showCount
  multiline
  autosize
  rows={3}
  maxRows={null}
  ariaLabel={null}
  idBase="f"
  {onchange}
  {onenter}
  {prefix}
  {suffix}
  class="c"
/>
`;

const NEGATIVES: Array<{ name: string; markup: string; script?: string; match: RegExp }> = [
  {
    name: 'bind:modelValue is string, not number',
    markup: `<TextField bind:modelValue={count} />`,
    script: `let count = $state(0);`,
    match: /Type 'number' is not assignable to type 'string/,
  },
  {
    name: 'onchange payload is a TextFieldValuePayload, not a string',
    markup: `<TextField onchange={(p) => p.toUpperCase()} />`,
    match: /Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/,
  },
  {
    name: 'onenter payload value is a string',
    markup: `<TextField onenter={(p) => p.value.toExponential()} />`,
    match: /Property 'toExponential' does not exist on type 'string'/,
  },
  {
    name: 'exposed clear() takes no arguments',
    script: `let inst: ReturnType<typeof TextField> | undefined = $state();\n  inst?.clear(1);`,
    markup: `<TextField bind:this={inst} />`,
    match: /Expected 0 arguments, but got 1/,
  },
  {
    name: 'label rejects a number',
    markup: `<TextField label={5} />`,
    match: /Type 'number' is not assignable to type 'string/,
  },
  {
    name: 'maxLength rejects a string',
    markup: `<TextField maxLength="x" />`,
    match: /Type 'string' is not assignable to type 'number/,
  },
];

function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-text-field-'));
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

describe('SVELTE-TEXT-FIELD-TYPED-SURFACE — bind:modelValue string, typed onchange/onenter payload, typed exposed verbs', () => {
  const r0 = compile(SRC, { target: 'svelte', filename: 'TextField.rozie', sourceMap: false });
  const svelte = flatten(r0.code);
  const files = (consumer: string) => ({ 'TextField.svelte': svelte, 'autosize.ts': HELPER, 'Consumer.svelte': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer is svelte-check clean', () => {
    const r = svelteCheck(files(OK));
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const consumer = `<script lang="ts">\n  import TextField from './TextField.svelte';\n  ${neg.script ?? ''}\n</script>\n\n${neg.markup}\n`;
      const r = svelteCheck(files(consumer));
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|Cannot find name|has no exported member/);
    });
  }
});

/**
 * SVELTE-ATTRS-SURFACE — typed public surface phase 3 (spec §5).
 *
 * A single-<button>-root, attr-inheriting component's Svelte props type is
 * `interface Props extends Omit<SvelteHTMLElements['button'], …>` (inline
 * `.svelte`) / `export interface AttrsButtonProps extends Omit<…>` (the
 * `.d.rozie.ts` sidecar). A consumer can pass the root's HTML attributes with
 * no cast; an attribute the root does not support, or a value that contradicts
 * an own prop, is an error.
 *
 * Red-first anchor: before phase 3 the inline Props carried
 * `[key: string]: unknown`, so the negatives (`href`, `title="x"`) passed
 * svelte-check; the sidecar had no index signature, so `class` / `style` /
 * `disabled` failed.
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
const FIXTURE = readFileSync(resolve(ROOT, 'tests/fixtures/typed-surface/AttrsButton.rozie'), 'utf8');

const POSITIVE_SVELTE = `<script lang="ts">
  import AttrsButton from './AttrsButton.svelte';
</script>

<AttrsButton
  label="x"
  title={3}
  class="c"
  style="color: red"
  id="i"
  aria-label="l"
  data-test="t"
  disabled
  type="button"
  onclick={(e) => e.currentTarget.blur()}
  onpress={() => {}}
/>
`;

const SIDECAR_CONSUMER_TS = `import type AttrsButton from './AttrsButtonSidecar';
import type { ComponentProps } from 'svelte';

export const ok: ComponentProps<typeof AttrsButton> = {
  label: 'x',
  title: 3,
  class: 'c',
  style: 'color: red',
  id: 'i',
  'aria-label': 'l',
  disabled: true,
};
// @ts-expect-error — not a <button> attribute
export const badHref: ComponentProps<typeof AttrsButton> = { href: '/x' };
// @ts-expect-error — own \`title: number\` wins
export const badTitle: ComponentProps<typeof AttrsButton> = { title: 'x' };
`;

function compiledSvelte(): string {
  const result = compile(FIXTURE, { target: 'svelte', filename: 'AttrsButton.rozie', sourceMap: false });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.code;
}

/** Run svelte-check over `files` in a fresh tmpdir; returns `{ threw, output }`. */
function svelteCheck(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-attrs-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    const svelteCheckBin = resolve(HERE, 'node_modules/.bin/svelte-check');
    try {
      execFileSync(
        svelteCheckBin,
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

describe('SVELTE-ATTRS-SURFACE — pass-through HTML attrs (typed-surface P3)', () => {
  it('positive: inline consumer passing root <button> attrs is svelte-check clean', () => {
    const { threw, output } = svelteCheck({
      'AttrsButton.svelte': compiledSvelte(),
      'Consumer.svelte': POSITIVE_SVELTE,
    });
    expect(threw, output).toBe(false);
  });

  it.each([
    // Match the excess-property diagnostic itself, not any output mentioning href.
    ['href (not a <button> attribute)', '<AttrsButton href="/x" />', /'"href"' does not exist in type/],
    ['title="x" (own `title: number` wins)', '<AttrsButton title="x" />', /not assignable to type 'number'/],
  ])('negative: inline consumer passing %s fails svelte-check', (_label, usage, pattern) => {
    const consumer = `<script lang="ts">\n  import AttrsButton from './AttrsButton.svelte';\n</script>\n\n${usage}\n`;
    const { threw, output } = svelteCheck({
      'AttrsButton.svelte': compiledSvelte(),
      'Consumer.svelte': consumer,
    });
    expect(threw).toBe(true);
    expect(output).toMatch(pattern);
  });

  it('svg root (review finding #1): the component AND a consumer passing SVG attributes are svelte-check clean', () => {
    const svgSrc = readFileSync(resolve(ROOT, 'tests/fixtures/typed-surface/SvgIcon.rozie'), 'utf8');
    const result = compile(svgSrc, { target: 'svelte', filename: 'SvgIcon.rozie', sourceMap: false });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const consumer = `<script lang="ts">\n  import SvgIcon from './SvgIcon.svelte';\n</script>\n\n<SvgIcon size={24} fill="red" stroke="currentColor" class="c" aria-hidden="true" />\n`;
    const { threw, output } = svelteCheck({ 'SvgIcon.svelte': result.code, 'Consumer.svelte': consumer });
    expect(threw, output).toBe(false);
  });

  it('sidecar: .d.rozie.ts consumer accepts root attrs; negatives stay errors', () => {
    const { ast } = parse(FIXTURE, { filename: 'AttrsButton.rozie' });
    if (!ast) throw new Error('parse() returned null for AttrsButton.rozie');
    const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    if (!ir) throw new Error('lowerToIR() returned null for AttrsButton.rozie');
    const dts = emitSvelteTypes(ir);
    expect(dts).toMatch(/export interface AttrsButtonProps/);
    const { threw, output } = svelteCheck({
      'AttrsButtonSidecar.d.ts': dts,
      'consumer.ts': SIDECAR_CONSUMER_TS,
    });
    expect(threw, output).toBe(false);
  });
});

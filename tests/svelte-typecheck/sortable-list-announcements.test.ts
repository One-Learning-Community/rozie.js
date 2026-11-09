/**
 * SVELTE-SORTABLE-LIST-ANNOUNCEMENTS — the Svelte half of the `announcements`
 * consumer gate (react/solid/lit: tests/strict-conformance). Checks
 * compile(SortableList.rozie) with svelte-check: an inline
 * `announcements={{ moved: ({ label, position, total }) => … }}` has its
 * context typed, and the types import from the component module (the Svelte
 * package entry IS the component). This harness's tsconfig has
 * `noImplicitAny: false`, so the premise is that with the old `type: Object`
 * prop a wrong use of `label` was NOT an error (the context was `any`).
 * Only Consumer.svelte's errors count.
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
const PKG = resolve(ROOT, 'packages/ui/sortable-list');
const SRC = readFileSync(resolve(PKG, 'src/SortableList.rozie'), 'utf8');
const INTERNALS = ['useSortableJS.ts', 'keyboardRegistry.ts', 'announcements.ts'];

function files(consumer: string, source = SRC, extra: Record<string, string> = {}): Record<string, string> {
  const r = compile(source, { target: 'svelte', filename: 'SortableList.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const out: Record<string, string> = { 'SortableList.svelte': r.code.replaceAll("'./internal/", "'./"), ...extra, 'Consumer.svelte': consumer };
  for (const f of INTERNALS) out[f] = readFileSync(resolve(PKG, 'src/internal', f), 'utf8');
  return out;
}

/** svelte-check errors reported in Consumer.svelte only (machine output). */
function consumerErrors(fs: Record<string, string>): string[] {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-svelte-sortable-announcements-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(fs)) writeFileSync(join(tmpDir, name), body, 'utf8');
    let out = '';
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/svelte-check'), ['--tsconfig', './tsconfig.json', '--threshold', 'error', '--output', 'machine'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    }
    return out.split('\n').filter((l) => / ERROR "Consumer\.svelte" /.test(l));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const OK = `<script lang="ts">
  import SortableList, { type Announcements, type AnnouncementContext, type AnnouncementKind } from './SortableList.svelte';
  let items: string[] = $state([]);
  const k: AnnouncementKind = 'moved';
  const typed: Announcements = { lifted: (c: AnnouncementContext) => c.label + ' ' + String(c.position), liftEnded: () => null };
  void k;
</script>

<SortableList bind:items announcements={typed} />
<SortableList bind:items announcements={{ moved: ({ label, position, total }) => label + ' → ' + position + '/' + total, dropped: ({ label }) => label.toUpperCase() }} />
`;

const NEG = (markup: string) => `<script lang="ts">
  import SortableList from './SortableList.svelte';
</script>

${markup}
`;

describe('SVELTE-SORTABLE-LIST-ANNOUNCEMENTS — consumer of the announcements prop', () => {
  it('inline announcements are contextually typed and the types import from the component', () => {
    expect(consumerErrors(files(OK))).toEqual([]);
  });

  it('negative: label is a string', () => {
    const errs = consumerErrors(files(NEG(`<SortableList announcements={{ moved: ({ label }) => label.toFixed() }} />`)));
    expect(errs.join('\n')).toMatch(/Property 'toFixed' does not exist on type 'string'/);
  });

  it('negative: unknown kind', () => {
    const errs = consumerErrors(files(NEG(`<SortableList announcements={{ mvoed: () => 'x' }} />`)));
    expect(errs.join('\n')).toMatch(/Object literal may only specify known properties|does not exist in type/);
  });

  it('premise: with the old `type: Object` prop a wrong use of label is not an error', () => {
    const old = SRC.replace('type: Announcements,', 'type: Object,');
    expect(old).not.toBe(SRC);
    expect(consumerErrors(files(NEG(`<SortableList announcements={{ moved: ({ label }) => label.toFixed() }} />`), old))).toEqual([]);
  });
});

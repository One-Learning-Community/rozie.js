/**
 * ANGULAR-SORTABLE-LIST-ANNOUNCEMENTS — the Angular half of the `announcements`
 * consumer gate (react/solid/lit: tests/strict-conformance). Checks
 * compile(SortableList.rozie) with tsc: a value assigned to the
 * `announcements` input's type (an inline `{ moved: ({ label, position, total })
 * => … }`) has its context typed, and the types import from the component
 * module and the leaf barrel (`export * from './SortableList'`). This
 * harness's tsconfig has `noImplicitAny: false`, so the premise is that with
 * the old `type: Object` prop a wrong use of `label` was NOT an error. (Angular
 * template bindings are typed the same way by ngtsc from the input's type.)
 * Only consumer.ts's errors count.
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
  const r = compile(source, { target: 'angular', filename: 'SortableList.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const out: Record<string, string> = { 'SortableList.ts': r.code.replaceAll("'./internal/", "'./"), ...extra, 'consumer.ts': consumer };
  for (const f of INTERNALS) out[f] = readFileSync(resolve(PKG, 'src/internal', f), 'utf8');
  return out;
}

/** tsc errors reported in consumer.ts only. */
function consumerErrors(fs: Record<string, string>): string[] {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-sortable-announcements-'));
  try {
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    for (const [name, body] of Object.entries(fs)) writeFileSync(join(tmpDir, name), body, 'utf8');
    let out = '';
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    }
    return out.split('\n').filter((l) => /consumer\.ts\(\d+,\d+\): error/.test(l));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const PRELUDE = (from: string) => `import { SortableList, type Announcements, type AnnouncementContext, type AnnouncementKind } from '${from}';
/** What the \`announcements\` input accepts. */
type Input = NonNullable<ReturnType<SortableList['announcements']>>;
const k: AnnouncementKind = 'moved';
void k;
`;
const OK = (from: string) => `${PRELUDE(from)}
const typed: Announcements = { lifted: (c: AnnouncementContext) => c.label + ' ' + String(c.position), liftEnded: () => null };
const inline: Input = { moved: ({ label, position, total }) => label + ' → ' + position + '/' + total, dropped: ({ label }) => label.toUpperCase() };
const same: Input = typed;
void inline; void same;
`;
const NEG = (body: string) => `import { SortableList } from './SortableList';
type Input = NonNullable<ReturnType<SortableList['announcements']>>;
${body}
`;

describe('ANGULAR-SORTABLE-LIST-ANNOUNCEMENTS — consumer of the announcements input', () => {
  it('inline announcements are contextually typed and the types import from the component', () => {
    expect(consumerErrors(files(OK('./SortableList')))).toEqual([]);
  });

  it('the types are importable from the leaf barrel (src/index.ts)', () => {
    const barrel = readFileSync(resolve(PKG, 'packages/angular/src/index.ts'), 'utf8');
    expect(consumerErrors(files(OK('./index'), SRC, { 'index.ts': barrel }))).toEqual([]);
  });

  it('negative: label is a string', () => {
    const errs = consumerErrors(files(NEG(`export const bad: Input = { moved: ({ label }) => label.toFixed() };`)));
    expect(errs.join('\n')).toMatch(/TS2339: Property 'toFixed' does not exist on type 'string'|TS2551: Property 'toFixed'/);
  });

  it('negative: unknown kind', () => {
    const errs = consumerErrors(files(NEG(`export const bad: Input = { mvoed: () => 'x' };`)));
    expect(errs.join('\n')).toMatch(/TS2561|TS2353/);
  });

  it('premise: with the old `type: Object` prop a wrong use of label is not an error', () => {
    const old = SRC.replace('type: Announcements,', 'type: Object,');
    expect(old).not.toBe(SRC);
    expect(consumerErrors(files(NEG(`export const bad: Input = { moved: ({ label }) => label.toFixed() };`), old))).toEqual([]);
  });
});

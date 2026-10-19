/**
 * ANGULAR-DIALOG-TYPED-SURFACE — the Angular half of the consumer-side
 * typed-surface gate (quick 261018-vdu). tsc-checks compile(Dialog.rozie): the
 * `open` model is a `ModelSignal<boolean>`, the `close` output carries a
 * `DialogClosePayload`, props are typed and the handle verbs take no arguments.
 * Negatives are pinned to specific TS codes + messages.
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

const PRELUDE = `import { Dialog, type DialogClosePayload, type DialogCloseReason } from './Dialog';
import type { ModelSignal } from '@angular/core';
declare const c: Dialog;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const OK = `${PRELUDE}
c.open.subscribe((open: boolean) => { const b: boolean = open; void b; });
c.openChange.subscribe((open: boolean) => { const b: boolean = open; void b; });
c.close.subscribe((p) => { const q: DialogClosePayload = p; const r: DialogCloseReason = p.reason; void q; void r; });
c.show();
c.hide();
const isOpen: boolean = c.open();
const label: string | null = c.ariaLabel();
const openIsBoolean: Equal<typeof c.open, ModelSignal<boolean>> = true;
void isOpen; void label; void openIsBoolean;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'close payload reason is a DialogCloseReason',
    body: `c.close.subscribe((p) => p.reason.toExponential());`,
    match: /TS2339: Property 'toExponential' does not exist on type 'DialogCloseReason'/,
  },
  {
    name: 'open change payload is boolean',
    body: `c.open.subscribe((open) => open.toFixed());`,
    match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/,
  },
  {
    name: 'handle show() takes no arguments',
    body: `c.show(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
  {
    name: 'open() reads a boolean, not a string',
    body: `const s: string = c.open();`,
    match: /TS2322: Type 'boolean' is not assignable to type 'string'/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-dialog-'));
  try {
    for (const [name, code] of Object.entries(files)) writeFileSync(join(tmpDir, name), code, 'utf8');
    copyFileSync(join(HERE, 'tsconfig.json'), join(tmpDir, 'tsconfig.json'));
    symlinkSync(join(HERE, 'node_modules'), join(tmpDir, 'node_modules'), 'dir');
    try {
      execFileSync(resolve(HERE, 'node_modules/.bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], { cwd: tmpDir, stdio: 'pipe' });
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

describe('ANGULAR-DIALOG-TYPED-SURFACE — open: ModelSignal<boolean>, typed close output, typed handle', () => {
  const r0 = compile(SRC, { target: 'angular', filename: 'Dialog.rozie', sourceMap: false });
  const ng = flatten(r0.code);
  const files = (consumer: string) => ({ 'Dialog.ts': ng, 'scrollLock.ts': HELPER, 'consumer.ts': consumer });

  it('compiles without errors', () => {
    expect(r0.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('typed consumer tsc-checks clean', () => {
    const r = tsc(files(OK));
    expect(r.threw, r.output).toBe(false);
  });

  for (const neg of NEGATIVES) {
    it(`negative fails for the right reason: ${neg.name}`, () => {
      const r = tsc(files(`${PRELUDE}\n${neg.body}\n`));
      expect(r.threw).toBe(true);
      expect(r.output).toMatch(neg.match);
      expect(r.output).not.toMatch(/TS2304|TS2614|TS2305|Cannot find name|has no exported member/);
    });
  }
});

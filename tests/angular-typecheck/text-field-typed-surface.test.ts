/**
 * ANGULAR-TEXT-FIELD-TYPED-SURFACE — the Angular half of the consumer-side
 * typed-surface gate for `@rozie-ui/text-field` (mirrors
 * dialog-typed-surface.test.ts). tsc-checks compile(TextField.rozie): the
 * `modelValue` model is a `ModelSignal<string>` (the ControlValueAccessor
 * model), the `change` / `enter` outputs carry a `TextFieldValuePayload`, props
 * are typed and the exposed verbs (focus / select / clear) take no arguments.
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/TextField.rozie'), 'utf8');
const HELPER = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/internal/autosize.ts'), 'utf8');

/** Flatten the one vendored-helper import so the real helper typechecks too. */
const flatten = (code: string) => code.replace("'./internal/autosize'", "'./autosize'");

const PRELUDE = `import { TextField, type TextFieldValuePayload } from './TextField';
import type { ModelSignal } from '@angular/core';
declare const c: TextField;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
`;

const OK = `${PRELUDE}
c.modelValue.subscribe((v: string) => { const s: string = v; void s; });
c.modelValueChange.subscribe((v: string) => { const s: string = v; void s; });
c.change.subscribe((p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; });
c.enter.subscribe((p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; });
c.focus();
c.select();
c.clear();
const text: string = c.modelValue();
const label: string = c.label();
const invalid: boolean = c.invalid();
const max: number | null = c.maxLength();
const rows: number = c.rows();
const aria: string | null = c.ariaLabel();
const modelIsString: Equal<typeof c.modelValue, ModelSignal<string>> = true;
void text; void label; void invalid; void max; void rows; void aria; void modelIsString;
`;

const NEGATIVES: Array<{ name: string; body: string; match: RegExp }> = [
  {
    name: 'change payload is a TextFieldValuePayload, not a string',
    body: `c.change.subscribe((p) => p.toUpperCase());`,
    match: /TS2339: Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/,
  },
  {
    name: 'enter payload value is a string',
    body: `c.enter.subscribe((p) => p.value.toExponential());`,
    match: /TS2339: Property 'toExponential' does not exist on type 'string'/,
  },
  {
    name: 'modelValue change payload is string',
    body: `c.modelValue.subscribe((v) => v.toExponential());`,
    match: /TS2339: Property 'toExponential' does not exist on type 'string'/,
  },
  {
    name: 'exposed clear() takes no arguments',
    body: `c.clear(1);`,
    match: /TS2554: Expected 0 arguments, but got 1/,
  },
  {
    name: 'modelValue() reads a string, not a number',
    body: `const n: number = c.modelValue();`,
    match: /TS2322: Type 'string' is not assignable to type 'number'/,
  },
  {
    name: 'maxLength() reads number | null, not a string',
    body: `const s: string = c.maxLength();`,
    match: /TS2322: Type 'number \| null' is not assignable to type 'string'/,
  },
];

function tsc(files: Record<string, string>): { threw: boolean; output: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-angular-text-field-'));
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

describe('ANGULAR-TEXT-FIELD-TYPED-SURFACE — modelValue: ModelSignal<string>, typed change/enter outputs, typed exposed verbs', () => {
  const r0 = compile(SRC, { target: 'angular', filename: 'TextField.rozie', sourceMap: false });
  const ng = flatten(r0.code);
  const files = (consumer: string) => ({ 'TextField.ts': ng, 'autosize.ts': HELPER, 'consumer.ts': consumer });

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

/**
 * TEXT-FIELD-TYPED-SURFACE — the consumer-side typed-surface gate for
 * `@rozie-ui/text-field` (mirrors dialog-typed-surface.test.ts).
 *
 * `compile(TextField.rozie)` for react/solid/lit, then a STRICT consumer sees:
 *   - the `modelValue` model's change event typed `string`,
 *   - the `change` / `enter` payloads typed `TextFieldValuePayload`
 *     (`{ value: string }`), importable by name,
 *   - the props typed (`label` is `string`, `maxLength` is `number | null`),
 *   - the typed handle (`TextFieldHandle` = { focus, select, clear } on
 *     React/Solid; the element itself on Lit).
 * Negatives are `@ts-expect-error` (TS2578 if one stops erroring) AND a separate
 * run of each negative WITHOUT the directive pins the specific TS error, so a
 * negative can never pass vacuously. (vue / svelte / angular live in their own
 * harness dirs.)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/TextField.rozie'), 'utf8');
const AUTOSIZE = readFileSync(resolve(ROOT, 'packages/ui/text-field/src/internal/autosize.ts'), 'utf8');

/** Compile, and flatten the one vendored-helper import so the real helper typechecks too. */
function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: 'TextField.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code.replace("'./internal/autosize'", "'./autosize'");
}

const REACT_PRELUDE = `import { useRef } from 'react';
import TextField, { type TextFieldHandle, type TextFieldValuePayload } from './TextField';
const h = useRef<TextFieldHandle>(null);
`;
const REACT_OK = `${REACT_PRELUDE}
h.current?.focus();
h.current?.select();
h.current?.clear();
export const ok = (
  <TextField
    ref={h}
    modelValue="a"
    onModelValueChange={(next) => { const s: string = next; void s; }}
    onChange={(p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; }}
    onEnter={(p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; }}
    label="Email"
    description="d"
    error=""
    invalid
    type="email"
    placeholder="p"
    name="n"
    autocomplete="email"
    required
    disabled
    readonly
    maxLength={10}
    showCount
    multiline
    autosize
    rows={3}
    maxRows={8}
    ariaLabel="x"
    idBase="f"
    renderPrefix={() => <span>$</span>}
    renderSuffix={() => <span>kg</span>}
    className="c"
  />
);
export const okNull = <TextField maxLength={null} maxRows={null} ariaLabel={null} defaultModelValue="d" />;
`;
const REACT_NEG = {
  payload: { line: `export const bad = <TextField onChange={(p) => p.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/ },
  enter: { line: `export const bad = <TextField onEnter={(p) => p.value.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  model: { line: `export const bad = <TextField onModelValueChange={(n) => n.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  verb: { line: `h.current?.clear(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `export const bad = <TextField label={5} />;`, match: /TS2322: Type 'number' is not assignable to type 'string'/ },
  maxLength: { line: `export const bad = <TextField maxLength="x" />;`, match: /TS2322: Type 'string' is not assignable to type 'number'/ },
};

const SOLID_PRELUDE = `import TextField, { type TextFieldHandle, type TextFieldValuePayload } from './TextField';
let h: TextFieldHandle | undefined;
`;
const SOLID_OK = `${SOLID_PRELUDE}
h?.focus();
h?.select();
h?.clear();
export const ok = (
  <TextField
    ref={(x) => { h = x; }}
    modelValue="a"
    onModelValueChange={(next) => { const s: string = next; void s; }}
    onChange={(p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; }}
    onEnter={(p) => { const q: TextFieldValuePayload = p; const v: string = p.value; void q; void v; }}
    label="Email"
    description="d"
    error=""
    invalid
    type="email"
    placeholder="p"
    name="n"
    autocomplete="email"
    required
    disabled
    readonly
    maxLength={10}
    showCount
    multiline
    autosize
    rows={3}
    maxRows={8}
    ariaLabel="x"
    idBase="f"
    prefixSlot={<span>$</span>}
    suffixSlot={<span>kg</span>}
    class="c"
  />
);
export const okNull = <TextField maxLength={null} maxRows={null} ariaLabel={null} />;
`;
const SOLID_NEG = {
  payload: { line: `export const bad = <TextField onChange={(p) => p.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/ },
  enter: { line: `export const bad = <TextField onEnter={(p) => p.value.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  model: { line: `export const bad = <TextField onModelValueChange={(n) => n.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  verb: { line: `h?.clear(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `export const bad = <TextField label={5} />;`, match: /TS2322: Type 'number' is not assignable to type 'string'/ },
  maxLength: { line: `export const bad = <TextField maxLength="x" />;`, match: /TS2322: Type 'string' is not assignable to type 'number'/ },
};

const LIT_PRELUDE = `import TextField, { type TextFieldValuePayload } from './TextField';
declare const el: TextField;
`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('model-value-change', (e) => { const s: string = e.detail; void s; });
el.addEventListener('change', (e) => { const q: TextFieldValuePayload = e.detail; const v: string = e.detail.value; void q; void v; });
el.addEventListener('enter', (e) => { const q: TextFieldValuePayload = e.detail; const v: string = e.detail.value; void q; void v; });
el.addEventListener('click', (e) => e.clientX.toFixed());
el.modelValue = 'a';
el.label = 'Email';
el.description = 'd';
el.error = '';
el.invalid = true;
el.type = 'email';
el.placeholder = 'p';
el.required = true;
el.disabled = true;
el.readonly = true;
el.maxLength = 10;
el.maxLength = null;
el.showCount = true;
el.multiline = true;
el.autosize = true;
el.rows = 3;
el.maxRows = null;
el.ariaLabel = null;
el.idBase = 'f';
el.focus();
el.select();
el.clear();
`;
const LIT_NEG = {
  payload: { line: `el.addEventListener('change', (e) => e.detail.toUpperCase());`, match: /TS2339: Property 'toUpperCase' does not exist on type 'TextFieldValuePayload'/ },
  enter: { line: `el.addEventListener('enter', (e) => e.detail.value.toExponential());`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  model: { line: `el.addEventListener('model-value-change', (e) => e.detail.toExponential());`, match: /TS2339: Property 'toExponential' does not exist on type 'string'/ },
  verb: { line: `el.clear(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `el.label = 5;`, match: /TS2322: Type 'number' is not assignable to type 'string'/ },
  maxLength: { line: `el.maxLength = 'x';`, match: /TS2322: Type 'string' is not assignable to type 'number'/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'TextField.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/text-field/packages/react', ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'TextField.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/text-field/packages/solid', ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'TextField.ts', consumer: 'Consumer.ts', nm: 'packages/ui/text-field/packages/lit', ok: LIT_OK, neg: LIT_NEG },
];

describe('TEXT-FIELD-TYPED-SURFACE — typed change/enter payload + modelValue model + typed handle (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.target, () => {
      const code = compiled(c.target);
      const run = (consumerSrc: string) =>
        typecheckCompiled({
          target: c.target,
          files: { [c.file]: code, 'autosize.ts': AUTOSIZE, [c.consumer]: consumerSrc },
          nodeModulesFrom: c.nm,
        });

      it('strict consumer with @ts-expect-error negatives is clean', () => {
        const withNegs =
          c.ok + '\n' + Object.values(c.neg).map((n, i) => expectErr(n.line).replace(/\bbad\b/, `bad${i}`)).join('\n') + '\n';
        const { raw, inventory } = run(withNegs);
        expect(totalErrors(inventory), raw).toBe(0);
      });

      for (const [name, neg] of Object.entries(c.neg)) {
        it(`negative (${name}) fails for the right reason when the directive is removed`, () => {
          const { raw, inventory } = run(`${c.ok}\n${neg.line.replace(/\bbad\b/, 'badX')}\n`);
          expect(totalErrors(inventory)).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }
    });
  }
});

/**
 * Barrel parity: the package entry (`src/index.ts`, the committed leaf barrel)
 * must let a consumer name the public types — the handle and payload types on
 * React/Solid, and on Lit the `RozieTextFieldEventMap` (the element is the handle).
 */
describe('TEXT-FIELD-TYPED-SURFACE — leaf barrel re-exports the public types', () => {
  const BARREL_CONSUMERS = {
    react: `import { TextField, type TextFieldHandle, type TextFieldValuePayload } from './index';\ndeclare const h: TextFieldHandle;\nh.focus();\nconst p: TextFieldValuePayload = { value: 'x' };\nvoid TextField; void p;\n`,
    solid: `import { TextField, type TextFieldHandle, type TextFieldValuePayload } from './index';\ndeclare const h: TextFieldHandle;\nh.focus();\nconst p: TextFieldValuePayload = { value: 'x' };\nvoid TextField; void p;\n`,
    lit: `import { TextField, type RozieTextFieldEventMap, type TextFieldValuePayload } from './index';\nconst e: RozieTextFieldEventMap['change'] = new CustomEvent('change', { detail: { value: 'x' } });\nconst p: TextFieldValuePayload = e.detail;\ndeclare const el: TextField;\nel.clear();\nvoid p;\n`,
  } as const;
  for (const c of CASES) {
    it(`${c.target}: public types importable from the barrel`, () => {
      const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
      const { raw, inventory } = typecheckCompiled({
        target: c.target,
        files: { [c.file]: compiled(c.target), 'autosize.ts': AUTOSIZE, 'index.ts': index, [c.consumer]: BARREL_CONSUMERS[c.target] },
        nodeModulesFrom: c.nm,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});

/**
 * COMBOBOX-TYPED-SURFACE — typed public surface (release-0.8.0 token-input wave).
 *
 * `compile(Combobox.rozie)` for react/solid/lit, then a strict consumer sees:
 *   - `search` / `change` / `create` payloads typed (`ComboboxSearchPayload`,
 *     `ComboboxChangePayload` incl. the optional free-text `text`, `ComboboxCreatePayload`),
 *   - every slot ctx typed (chip / option / empty / create / groupHeading / groupMore),
 *   - the token-input props (block, chipLayout, disableOpenOnFocus, hideEmpty,
 *     delimiters, validate, selectOnTab) accepted,
 *   - typed handle verbs (`activeOption()`, `seedQuery(text)`, `pinOpen(v)`).
 * Negatives are `@ts-expect-error` (TS2578 if one stops erroring) AND a separate
 * run of each negative WITHOUT the directive pins the specific TS error.
 * (vue / svelte / angular live in their own harness dirs.)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_PATH = resolve(ROOT, 'packages/ui/combobox/src/Combobox.rozie');
const SRC = readFileSync(SRC_PATH, 'utf8');

/** Replace the vendored runtime helper import with a stub (not part of the surface). */
function stubInternals(code: string): string {
  return code.replace(/^import \{ groupOptions \} from '\.\/internal\/groupOptions';$/m, 'const groupOptions: any = undefined;');
}

function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: SRC_PATH, sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return stubInternals(r.code);
}

const TYPE_IMPORTS =
  'type ComboboxSearchPayload, type ComboboxChangePayload, type ComboboxCreatePayload, type ComboboxChipSlotCtx, type ComboboxOptionSlotCtx, type ComboboxQuerySlotCtx, type ComboboxGroupHeadingSlotCtx, type ComboboxGroupMoreSlotCtx, type ComboboxGroup';

/** Shared type-level assertions over the exported names (target-neutral TS). */
const TYPE_ASSERTS = `
declare const sp: ComboboxSearchPayload; const sq: string = sp.query;
declare const cp: ComboboxChangePayload; const cs: boolean = cp.selected; const ct: string | undefined = cp.text; const cv: unknown = cp.value; const co: unknown = cp.option;
declare const crp: ComboboxCreatePayload; const crq: string = crp.query;
declare const chip: ComboboxChipSlotCtx; const chi: number = chip.index; chip.remove();
declare const oc: ComboboxOptionSlotCtx; const ob: boolean = oc.active && oc.selected && oc.disabled; const oi: number = oc.index;
declare const qc: ComboboxQuerySlotCtx; const qq: string = qc.query;
declare const gh: ComboboxGroupHeadingSlotCtx; const g: ComboboxGroup = gh.group; const gid: string = g.id + gh.group.label;
declare const gm: ComboboxGroupMoreSlotCtx; const gmh: number = gm.hidden; const gmg: ComboboxGroup | null = gm.group; gm.expand();
void sq; void cs; void ct; void cv; void co; void crq; void chi; void ob; void oi; void qq; void gid; void gmh; void gmg;
const isEmail = (text: string): boolean => text.includes('@');
`;

const REACT_PRELUDE = `import { useRef } from 'react';
import Combobox, { type ComboboxHandle, ${TYPE_IMPORTS} } from './Combobox';
const h = useRef<ComboboxHandle>(null);
${TYPE_ASSERTS}`;
const REACT_OK = `${REACT_PRELUDE}
const picked: any = h.current?.activeOption();
h.current?.seedQuery('x');
h.current?.pinOpen(true);
h.current?.focus();
h.current?.clear();
void picked;
export const ok = (
  <Combobox
    ref={h}
    multiple
    block
    chipLayout="inline"
    disableOpenOnFocus
    hideEmpty
    delimiters={[',', ';']}
    validate={isEmail}
    selectOnTab
    onSearch={(p) => { const q: string = p.query; void q; }}
    onChange={(p) => { const s: boolean = p.selected; const t: string | undefined = p.text; const x: ComboboxChangePayload = p; void s; void t; void x; }}
    onCreate={(p) => { const q: string = p.query; void q; }}
    renderChip={({ option, remove, index }) => { const i: number = index; remove(); void option; void i; return null; }}
    renderOption={({ index, active, selected, disabled }) => { const i: number = index; const b: boolean = active && selected && disabled; void i; void b; return null; }}
    renderEmpty={({ query }) => { const q: string = query; void q; return null; }}
    renderCreate={({ query }) => { const q: string = query; void q; return null; }}
    renderGroupHeading={({ group }) => { const id: string = group.id; const l: string = group.label; void id; void l; return null; }}
    renderGroupMore={({ group, hidden, expand }) => { const n: number = hidden; const gg: ComboboxGroup | null = group; expand(); void n; void gg; return null; }}
  />
);
`;
const REACT_NEG = {
  payload: { line: `export const bad = <Combobox onChange={(p) => p.selected.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'boolean'/ },
  search: { line: `export const bad = <Combobox onSearch={(p) => p.query.toPrecision()} />;`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  text: { line: `const badText: number = cp.text;`, match: /TS2322: Type 'string \| undefined' is not assignable to type 'number'/ },
  slot: { line: `export const bad = <Combobox renderChip={({ index }) => { index.toUpperCase(); return null; }} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  verb: { line: `h.current?.seedQuery(1);`, match: /TS2345: Argument of type 'number' is not assignable to parameter of type 'string'/ },
  unknownVerb: { line: `h.current?.openList();`, match: /TS2339: Property 'openList' does not exist on type 'ComboboxHandle'/ },
};

const SOLID_PRELUDE = `import Combobox, { type ComboboxHandle, ${TYPE_IMPORTS} } from './Combobox';
let h: ComboboxHandle | undefined;
${TYPE_ASSERTS}`;
const SOLID_OK = `${SOLID_PRELUDE}
const picked: any = h?.activeOption();
h?.seedQuery('x');
h?.pinOpen(true);
void picked;
export const ok = (
  <Combobox
    ref={(x) => { h = x; }}
    multiple
    block
    chipLayout="inline"
    disableOpenOnFocus
    hideEmpty
    delimiters={[',', ';']}
    validate={isEmail}
    selectOnTab
    onSearch={(p) => { const q: string = p.query; void q; }}
    onChange={(p) => { const s: boolean = p.selected; const t: string | undefined = p.text; void s; void t; }}
    onCreate={(p) => { const q: string = p.query; void q; }}
    chipSlot={({ index, remove }) => { const i: number = index; remove(); return <span>{i}</span>; }}
    optionSlot={({ index, active }) => { const i: number = index; const b: boolean = active; return <span>{i}{String(b)}</span>; }}
    emptySlot={({ query }) => { const q: string = query; return <span>{q}</span>; }}
    createSlot={({ query }) => { const q: string = query; return <span>{q}</span>; }}
    groupHeadingSlot={({ group }) => { const l: string = group.label; return <span>{l}</span>; }}
    groupMoreSlot={({ hidden, expand }) => { const n: number = hidden; expand(); return <span>{n}</span>; }}
  />
);
`;
const SOLID_NEG = {
  payload: { line: `export const bad = <Combobox onChange={(p) => p.selected.toUpperCase()} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'boolean'/ },
  search: { line: `export const bad = <Combobox onSearch={(p) => p.query.toPrecision()} />;`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  text: { line: `const badText: number = cp.text;`, match: /TS2322: Type 'string \| undefined' is not assignable to type 'number'/ },
  slot: { line: `export const bad = <Combobox chipSlot={({ index }) => { index.toUpperCase(); return <span /> }} />;`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  verb: { line: `h?.seedQuery(1);`, match: /TS2345: Argument of type 'number' is not assignable to parameter of type 'string'/ },
  unknownVerb: { line: `h?.openList();`, match: /TS2339: Property 'openList' does not exist on type 'ComboboxHandle'/ },
};

const LIT_PRELUDE = `import Combobox, { ${TYPE_IMPORTS} } from './Combobox';
declare const el: Combobox;
${TYPE_ASSERTS}`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('search', (e) => { const q: string = e.detail.query; void q; });
el.addEventListener('change', (e) => { const s: boolean = e.detail.selected; const t: string | undefined = e.detail.text; void s; void t; });
el.addEventListener('create', (e) => { const q: string = e.detail.query; void q; });
el.block = true;
el.chipLayout = 'inline';
el.disableOpenOnFocus = true;
el.hideEmpty = true;
el.delimiters = [',', ';'];
el.validate = isEmail;
el.selectOnTab = true;
const picked: any = el.activeOption();
el.seedQuery('x');
el.pinOpen(true);
void picked;
el.chip = ({ index, remove }) => { const i: number = index; remove(); return String(i); };
el.option = ({ index, active }) => { const i: number = index; const b: boolean = active; return String(i) + String(b); };
el.empty = ({ query }) => { const q: string = query; return q; };
el.create = ({ query }) => { const q: string = query; return q; };
el.groupHeading = ({ group }) => { const l: string = group.label; return l; };
el.groupMore = ({ hidden, expand }) => { const n: number = hidden; expand(); return String(n); };
`;
const LIT_NEG = {
  payload: { line: `el.addEventListener('change', (e) => e.detail.selected.toUpperCase());`, match: /TS2339: Property 'toUpperCase' does not exist on type 'boolean'/ },
  search: { line: `el.addEventListener('search', (e) => e.detail.query.toPrecision());`, match: /Property 'toPrecision' does not exist on type 'string'/ },
  text: { line: `const badText: number = cp.text;`, match: /TS2322: Type 'string \| undefined' is not assignable to type 'number'/ },
  slot: { line: `el.chip = ({ index }) => { index.toUpperCase(); return ''; };`, match: /TS2339: Property 'toUpperCase' does not exist on type 'number'/ },
  verb: { line: `el.seedQuery(1);`, match: /TS2345: Argument of type 'number' is not assignable to parameter of type 'string'/ },
  unknownVerb: { line: `el.openList();`, match: /TS2339: Property 'openList' does not exist on type 'Combobox'/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'Combobox.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/combobox/packages/react', ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'Combobox.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/combobox/packages/solid', ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'Combobox.ts', consumer: 'Consumer.ts', nm: 'packages/ui/combobox/packages/lit', ok: LIT_OK, neg: LIT_NEG },
];

describe('COMBOBOX-TYPED-SURFACE — typed payloads, slot ctx, token-input props, typed handle (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.target, () => {
      const code = compiled(c.target);
      const run = (consumerSrc: string) =>
        typecheckCompiled({
          target: c.target,
          files: { [c.file]: code, [c.consumer]: consumerSrc },
          nodeModulesFrom: c.nm,
        });

      it('strict consumer with @ts-expect-error negatives is clean', () => {
        const withNegs =
          c.ok + '\n' + Object.values(c.neg).map((n, i) => expectErr(n.line).replace(/\bbad(Text)?\b/, `bad${i}`)).join('\n') + '\n';
        const { raw, inventory } = run(withNegs);
        // CONSUMER-surface gate only: the emitted React body carries two
        // pre-existing implicit-any r-for callback params (TS7006, untyped
        // `filteredOptions()` / `windowedView()` rows) that are not part of
        // the public typed surface (feedback: no cosmetic tsc on emitted bodies).
        expect(totalErrors({ [c.consumer]: inventory[c.consumer] ?? {} }), raw).toBe(0);
        expect(raw).not.toMatch(/TS2578/);
      });

      for (const [name, neg] of Object.entries(c.neg)) {
        it(`negative (${name}) fails for the right reason when the directive is removed`, () => {
          const { raw, inventory } = run(`${c.ok}\n${neg.line.replace(/\bbad(Text)?\b/, 'badX')}\n`);
          expect(totalErrors({ [c.consumer]: inventory[c.consumer] ?? {} })).toBeGreaterThan(0);
          expect(raw).toMatch(neg.match);
          expect(raw).not.toMatch(/TS2304|TS2305|TS2614|Cannot find name/);
        });
      }
    });
  }
});

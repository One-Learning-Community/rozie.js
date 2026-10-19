/**
 * DIALOG-TYPED-SURFACE — the durable, consumer-side form of the pre-release
 * dist probe (quick 261018-vdu).
 *
 * `compile(Dialog.rozie)` for react/solid/lit, then a STRICT consumer sees:
 *   - the `open` model's change event typed `boolean`,
 *   - the `close` payload typed `DialogClosePayload` (`reason: DialogCloseReason`),
 *     with the payload types importable by name,
 *   - the props typed (`initialFocus` is `string | Element | null`),
 *   - typed handle verbs (`show()` / `hide()` take no arguments).
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/Dialog.rozie'), 'utf8');
const SCROLL_LOCK = readFileSync(resolve(ROOT, 'packages/ui/dialog/src/internal/scrollLock.ts'), 'utf8');

/** Compile, and flatten the one vendored-helper import so the real helper typechecks too. */
function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: 'Dialog.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.code.replace("'./internal/scrollLock'", "'./scrollLock'");
}

const REACT_PRELUDE = `import { useRef } from 'react';
import Dialog, { type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './Dialog';
const h = useRef<DialogHandle>(null);
declare const el: HTMLElement;
`;
const REACT_OK = `${REACT_PRELUDE}
h.current?.show();
h.current?.hide();
export const ok = (
  <Dialog
    ref={h}
    open
    onOpenChange={(next) => { const b: boolean = next; void b; }}
    onClose={(p) => { const q: DialogClosePayload = p; const r: DialogCloseReason = p.reason; void q; void r; }}
    initialFocus="#a"
    ariaLabel="x"
    ariaLabelledby="t"
    disableBackdropClose
    className="c"
  >
    <p>hi</p>
  </Dialog>
);
export const okEl = <Dialog initialFocus={el} />;
`;
const REACT_NEG = {
  payload: { line: `export const bad = <Dialog onClose={(p) => p.reason.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'DialogCloseReason'/ },
  model: { line: `export const bad = <Dialog onOpenChange={(n) => n.toFixed()} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `h.current?.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `export const bad = <Dialog initialFocus={5} />;`, match: /TS2322: Type 'number' is not assignable to type/ },
};

const SOLID_PRELUDE = `import Dialog, { type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './Dialog';
let h: DialogHandle | undefined;
declare const el: HTMLElement;
`;
const SOLID_OK = `${SOLID_PRELUDE}
h?.show();
h?.hide();
export const ok = (
  <Dialog
    ref={(x) => { h = x; }}
    open
    onOpenChange={(next) => { const b: boolean = next; void b; }}
    onClose={(p) => { const q: DialogClosePayload = p; const r: DialogCloseReason = p.reason; void q; void r; }}
    initialFocus="#a"
    ariaLabel="x"
    ariaLabelledby="t"
    disableBackdropClose
    class="c"
  >
    <p>hi</p>
  </Dialog>
);
export const okEl = <Dialog initialFocus={el} />;
`;
const SOLID_NEG = {
  payload: { line: `export const bad = <Dialog onClose={(p) => p.reason.toExponential()} />;`, match: /TS2339: Property 'toExponential' does not exist on type 'DialogCloseReason'/ },
  model: { line: `export const bad = <Dialog onOpenChange={(n) => n.toFixed()} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `h?.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `export const bad = <Dialog initialFocus={5} />;`, match: /TS2322: Type 'number' is not assignable to type/ },
};

const LIT_PRELUDE = `import Dialog, { type DialogClosePayload, type DialogCloseReason } from './Dialog';
declare const el: Dialog;
declare const target: HTMLElement;
`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('open-change', (e) => { const b: boolean = e.detail; void b; });
el.addEventListener('close', (e) => { const q: DialogClosePayload = e.detail; const r: DialogCloseReason = e.detail.reason; void q; void r; });
el.addEventListener('click', (e) => e.clientX.toFixed());
el.open = true;
el.initialFocus = '#a';
el.initialFocus = target;
el.ariaLabel = 'x';
el.ariaLabelledby = 't';
el.disableBackdropClose = true;
el.show();
el.hide();
`;
const LIT_NEG = {
  payload: { line: `el.addEventListener('close', (e) => e.detail.reason.toExponential());`, match: /TS2339: Property 'toExponential' does not exist on type 'DialogCloseReason'/ },
  model: { line: `el.addEventListener('open-change', (e) => e.detail.toFixed());`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `el.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  prop: { line: `el.initialFocus = 5;`, match: /TS2322: Type '5' is not assignable to type/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'Dialog.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/dialog/packages/react', ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'Dialog.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/dialog/packages/solid', ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'Dialog.ts', consumer: 'Consumer.ts', nm: 'packages/ui/dialog/packages/lit', ok: LIT_OK, neg: LIT_NEG },
];

describe('DIALOG-TYPED-SURFACE — typed close payload + open model + typed handle (react/solid/lit)', () => {
  for (const c of CASES) {
    describe(c.target, () => {
      const code = compiled(c.target);
      const run = (consumerSrc: string) =>
        typecheckCompiled({
          target: c.target,
          files: { [c.file]: code, 'scrollLock.ts': SCROLL_LOCK, [c.consumer]: consumerSrc },
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
 * React/Solid, and on Lit the `RozieDialogEventMap` (the element is the handle).
 */
describe('DIALOG-TYPED-SURFACE — leaf barrel re-exports the public types', () => {
  const BARREL_CONSUMERS = {
    react: `import { Dialog, type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './index';\ndeclare const h: DialogHandle;\nh.show();\nconst p: DialogClosePayload = { reason: 'escape' satisfies DialogCloseReason };\nvoid Dialog; void p;\n`,
    solid: `import { Dialog, type DialogHandle, type DialogClosePayload, type DialogCloseReason } from './index';\ndeclare const h: DialogHandle;\nh.show();\nconst p: DialogClosePayload = { reason: 'escape' satisfies DialogCloseReason };\nvoid Dialog; void p;\n`,
    lit: `import { Dialog, type RozieDialogEventMap, type DialogClosePayload } from './index';\nconst e: RozieDialogEventMap['close'] = new CustomEvent('close', { detail: { reason: 'escape' } });\nconst p: DialogClosePayload = e.detail;\ndeclare const el: Dialog;\nel.show();\nvoid p;\n`,
  } as const;
  for (const c of CASES) {
    it(`${c.target}: public types importable from the barrel`, () => {
      const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
      const { raw, inventory } = typecheckCompiled({
        target: c.target,
        files: { [c.file]: compiled(c.target), 'scrollLock.ts': SCROLL_LOCK, 'index.ts': index, [c.consumer]: BARREL_CONSUMERS[c.target] },
        nodeModulesFrom: c.nm,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});

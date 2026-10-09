/**
 * POPOVER-TYPED-SURFACE — typed public surface phase 1 (Task 17, first adopter).
 *
 * `compile(Popover.rozie)` for react/solid/lit, then a strict consumer sees:
 *   - the `open` model's change event typed `boolean` (React/Solid
 *     `onOpenChange`, Lit `open-change` — the only change signal since the
 *     separate `change` emit was removed, release-0.8.0 audit B6), and
 *     `.toFixed()` on it rejected,
 *   - the `anchor` slot ctx typed (`open: boolean`, verbs `() => void`,
 *     `panelId: string`),
 *   - `reference` accepting a Floating UI `VirtualElement` and an Element,
 *   - typed handle verbs (`show()` ok, `show(1)` rejected),
 *   - React/Solid: the removed `change` event's `onChange` rejected (a
 *     `never` tombstone), not accepted as the native <div> change handler.
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
const SRC = readFileSync(resolve(ROOT, 'packages/ui/popover/src/Popover.rozie'), 'utf8');

/** Replace the two non-surface imports (engine + vendored helper) with stubs. */
function stubInternals(code: string): string {
  return code
    .replace(
      /^import \{[^}]*\} from '@floating-ui\/dom';$/m,
      'const computePosition: any = undefined, autoUpdate: any = undefined, offsetMiddleware: any = undefined, flip: any = undefined, shift: any = undefined, arrowMiddleware: any = undefined, size: any = undefined;',
    )
    .replace(/^import \{ buildMiddleware, AVAILABLE_WIDTH_PROPERTY \} from '\.\/internal\/middleware';$/m, "const buildMiddleware: any = undefined; const AVAILABLE_WIDTH_PROPERTY = '--rozie-popover-available-width';");
}

function compiled(target: 'react' | 'solid' | 'lit'): string {
  const r = compile(SRC, { target, filename: 'Popover.rozie', sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return stubInternals(r.code);
}

const REACT_PRELUDE = `import { useRef } from 'react';
import type { VirtualElement } from '@floating-ui/dom';
import Popover, { type PopoverHandle } from './Popover';
const h = useRef<PopoverHandle>(null);
declare const point: VirtualElement;
declare const el: HTMLElement;
`;
const REACT_OK = `${REACT_PRELUDE}
h.current?.show();
h.current?.hide();
h.current?.toggle();
h.current?.reposition();
export const ok = (
  <Popover
    ref={h}
    reference={point}
    onOpenChange={(open) => { const b: boolean = open; void b; }}
    renderAnchor={({ open, toggle, show, hide, panelId }) => { const b: boolean = open; const id: string = panelId; toggle(); show(); hide(); void b; void id; return null; }}
  />
);
export const okEl = <Popover reference={el} idBase="x" />;
`;
const REACT_NEG = {
  payload: { line: `export const bad = <Popover onOpenChange={(open) => open.toFixed()} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `h.current?.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  slot: { line: `export const bad = <Popover renderAnchor={({ open }) => { open.toFixed(); return null; }} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  // The removed `change` event is a tombstone (`onChange?: never`): it must NOT
  // fall into the native <div> passthrough as the DOM change handler.
  removedChange: { line: `export const bad = <Popover onChange={() => {}} />;`, match: /TS2322: Type '\(\) => void' is not assignable to type 'never'/ },
};

const SOLID_PRELUDE = `import type { VirtualElement } from '@floating-ui/dom';
import Popover, { type PopoverHandle } from './Popover';
let h: PopoverHandle | undefined;
declare const point: VirtualElement;
declare const el: HTMLElement;
`;
const SOLID_OK = `${SOLID_PRELUDE}
h?.show();
h?.hide();
h?.toggle();
h?.reposition();
export const ok = (
  <Popover
    ref={(x) => { h = x; }}
    reference={point}
    onOpenChange={(open) => { const b: boolean = open; void b; }}
    anchorSlot={({ open, toggle, show, hide, panelId }) => { const b: boolean = open; const id: string = panelId; toggle(); show(); hide(); return <span id={id}>{String(b)}</span>; }}
  />
);
export const okEl = <Popover reference={el} idBase="x" />;
`;
const SOLID_NEG = {
  payload: { line: `export const bad = <Popover onOpenChange={(open) => open.toFixed()} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `h?.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  slot: { line: `export const bad = <Popover anchorSlot={({ open }) => { open.toFixed(); return <span /> }} />;`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  removedChange: { line: `export const bad = <Popover onChange={() => {}} />;`, match: /TS2322: Type '\(\) => void' is not assignable to type 'never'/ },
};

const LIT_PRELUDE = `import type { VirtualElement } from '@floating-ui/dom';
import Popover from './Popover';
declare const el: Popover;
declare const point: VirtualElement;
`;
const LIT_OK = `${LIT_PRELUDE}
el.addEventListener('open-change', (e) => { const b: boolean = e.detail; void b; });
el.reference = point;
el.reference = document.body;
el.idBase = 'x';
el.addEventListener('click', (e) => e.clientX.toFixed());
el.show();
el.hide();
el.toggle();
el.reposition();
el.anchor = ({ open, toggle, show, hide, panelId }) => { const b: boolean = open; const id: string = panelId; toggle(); show(); hide(); return String(b) + id; };
`;
const LIT_NEG = {
  payload: { line: `el.addEventListener('open-change', (e) => e.detail.toFixed());`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
  verb: { line: `el.show(1);`, match: /TS2554: Expected 0 arguments, but got 1/ },
  slot: { line: `el.anchor = ({ open }) => { open.toFixed(); return ''; };`, match: /TS2339: Property 'toFixed' does not exist on type 'boolean'/ },
};

/** Mark a negative statement with @ts-expect-error (all negatives are top-level statements). */
const expectErr = (line: string) => `// @ts-expect-error — negative\n${line}`;

const CASES = [
  { target: 'react' as const, file: 'Popover.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/popover/packages/react', prelude: REACT_PRELUDE, ok: REACT_OK, neg: REACT_NEG },
  { target: 'solid' as const, file: 'Popover.tsx', consumer: 'Consumer.tsx', nm: 'packages/ui/popover/packages/solid', prelude: SOLID_PRELUDE, ok: SOLID_OK, neg: SOLID_NEG },
  { target: 'lit' as const, file: 'Popover.ts', consumer: 'Consumer.ts', nm: 'packages/ui/popover/packages/lit', prelude: LIT_PRELUDE, ok: LIT_OK, neg: LIT_NEG },
];

describe('POPOVER-TYPED-SURFACE — open change: boolean, typed anchor ctx, reference, typed handle (react/solid/lit)', () => {
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
 * Barrel parity (Task 18): the package entry (`src/index.ts`, committed leaf
 * barrel) must let a consumer name the public types — the handle on
 * React/Solid, and on Lit the `RoziePopoverEventMap` (the element is the handle).
 */
describe('POPOVER-TYPED-SURFACE — leaf barrel re-exports the public types', () => {
  const BARREL_CONSUMERS = {
    react: `import { Popover, type PopoverHandle } from './index';\ndeclare const h: PopoverHandle;\nh.show();\nvoid Popover;\n`,
    solid: `import { Popover, type PopoverHandle } from './index';\ndeclare const h: PopoverHandle;\nh.show();\nvoid Popover;\n`,
    lit: `import { Popover, type RoziePopoverEventMap } from './index';\nconst e: RoziePopoverEventMap['open-change'] = new CustomEvent('open-change', { detail: true });\ndeclare const el: Popover;\nel.show();\nvoid e;\n`,
  } as const;
  for (const c of CASES) {
    it(`${c.target}: public types importable from the barrel`, () => {
      const index = readFileSync(resolve(ROOT, c.nm, 'src/index.ts'), 'utf8');
      const { raw, inventory } = typecheckCompiled({
        target: c.target,
        files: { [c.file]: compiled(c.target), 'index.ts': index, [c.consumer]: BARREL_CONSUMERS[c.target] },
        nodeModulesFrom: c.nm,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});

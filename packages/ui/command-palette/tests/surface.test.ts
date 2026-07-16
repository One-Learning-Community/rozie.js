/**
 * surface.test.ts — the CommandPalette.rozie surface gate as a vitest test (so
 * it runs under `turbo run test`, not just scripts/compile-command-palette-check.mjs).
 *
 * Re-asserts the SAME contract the .mjs script checks:
 *   1. lowerToIR() emits ZERO error-severity diagnostics.
 *   2. The IR surface (name / props / model props / emits / slots / expose)
 *      matches the contract exactly.
 *   3. compile()×6 emits ZERO error-severity diagnostics + non-empty code. The
 *      DELIBERATE `focus` override is warn-only ROZ137 (accepted).
 *
 * Pure GLUE over the @rozie/core public API — no compiler/emitter/IR change.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'CommandPalette.rozie');
// Phase 75 (Option A): use the ABSOLUTE source path as the compile filename
// so the <components> producer resolution (resolveManifestProducer) walks
// node_modules upward from command-palette/src and finds the published
// @rozie-ui/combobox-<target> package (installed as a devDependency of this
// package's ROOT per Plan 05).
const FILENAME = SRC;
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'CommandPalette',
  // command-palette-levels (LVL-STACK/ASYNC): gained `searchDebounce`.
  // command-palette-sub-actions (ACT-MODEL/ACT-TRIGGER): gains `actionKey`
  // (the actionKey shortcut, default '$mod+k') and `closeOnAction` (default
  // true — whether running an action also closes the palette).
  // command-palette-13-empty-home-view-first: gains `defaultItems` — the
  // root's empty/home-view items (a nested level's own `defaultItems` field
  // is captured onto its frame, not a separate prop) — 13 props total.
  // command-palette-portal-overlay: gains `appendTo` — element-portal target
  // for the overlay root (default false = render in place) — 15 props total.
  // command-palette-per-level-virtual (FD-01 resolved — combobox-virtual-
  // reactivity, commits 6fd84251+afa0a7ec, made the vendored combobox's
  // `virtual` prop live-flippable): gains `virtual`/`virtualMaxHeight`/
  // `virtualEstimateRowHeight` — a virtual-windowing pass-through cluster
  // placed LAST, after `appendTo` — 18 props total.
  props: [
    'open',
    'query',
    'items',
    'defaultItems',
    'placeholder',
    'emptyText',
    'closeOnSelect',
    'ariaLabel',
    'idBase',
    'score',
    'searchDebounce',
    'actionKey',
    'closeOnAction',
    'groupCap',
    'appendTo',
    'virtual',
    'virtualMaxHeight',
    'virtualEstimateRowHeight',
  ],
  models: ['open', 'query'],
  // command-palette-levels: gains `navigate` (a level was pushed — payload
  // `{ item, depth }`) and `back` (a level was popped — no payload).
  // command-palette-sub-actions (ACT-MODEL): gains `action-select` (a row
  // action was chosen — payload `{ item, action }`).
  emits: ['select', 'navigate', 'back', 'action-select'],
  // D-05 (BREAKING, Phase 999.4): the public slots are re-aligned to the vendored
  // listbox vocabulary — `#item {item,active}` → `#option {option,index,active,
  // selected,disabled}`; `#empty` gains `{query}`; `#footer` unchanged (a panel
  // sibling outside the listbox). Additive (quick 260714-dc3): three display-only
  // option-row sub-slots live INSIDE the default `#option` fill — `#icon`
  // (scope `{ option }`), `#trailing` (scope `{ option }`), `#actions` (scope
  // `{ option, actions }`) — each renders nothing when unfilled.
  // command-palette-levels: gains `loading` (scope `{ query }`), `error`
  // (scope `{ query, error, retry }`) — re-projected inside combobox's
  // #empty region — and `breadcrumb` (scope `{ stack, back }`) — the
  // depth>0 header, a panel sibling OUTSIDE the combobox.
  // command-palette-sub-actions (ACT-RENDER): gains `actionItem` (scope
  // `{ action, item, active, disabled }`) — the per-menu-item slot. NOT
  // `action-item` (hyphenated) — a hyphenated slot name fails ROZ127 (Vue's
  // `defineSlots<{…}>()` can't emit an unquoted hyphenated object key); the
  // existing `#actions` slot is KEPT unchanged (now doubles as the
  // interactive open-the-menu affordance — see CommandPalette.rozie).
  // cp-adopts-combobox-groups: gains `groupHeading` (scope `{ group }`) —
  // the re-projected vendored <Combobox>'s native section-heading slot.
  // command-palette-inline-args (ARGS-RENDER, feature #12): gains
  // `argsField` (scope `{ item, arg, value, setValue }`) — the panel-
  // internal args surface's per-field override slot (camelCase, ROZ127-clear
  // — mirrors `actionItem`'s naming precedent) — 12 slots total.
  slots: [
    'option',
    'empty',
    'footer',
    'icon',
    'trailing',
    'actions',
    'loading',
    'error',
    'breadcrumb',
    'actionItem',
    'groupHeading',
    'argsField',
  ],
  // command-palette-levels: gains `openTo` (the ⌘P deep-link) and `goBack`
  // (pop one level). The pop verb is `goBack`, NOT `back` — a `back()`
  // expose verb would collide with the `back` EMIT above (ROZ121:
  // expose∩emits must be empty) — see the dedicated assertion below.
  // command-palette-sub-actions: NO new expose verb (openActionMenu/
  // closeActionMenu are internal-only — see the dedicated assertion below).
  expose: ['show', 'close', 'toggle', 'focus', 'openTo', 'goBack'],
} as const;

// D-07 (LOAD-BEARING): the authored CommandPalette.rozie must use the STABLE
// package-style specifier and NEVER a local relative form. This is the
// byte-identity invariant — Phase 75 graduated this pair from Option B
// (vendored, in-memory remap before compile) to Option A (published,
// resolved directly by the compiler) without touching this specifier at all.
const STABLE_COMBOBOX_SPECIFIER = '@rozie-ui/combobox/Combobox.rozie';
const RELATIVE_COMBOBOX_SPECIFIER = './Combobox.rozie';

const sorted = (a: readonly string[]) => [...a].sort();

describe('CommandPalette.rozie surface gate', () => {
  // Phase 75: compile the RAW authored source directly — no in-memory
  // specifier remap. The stable `@rozie-ui/combobox/Combobox.rozie` specifier
  // resolves to the published per-target manifest via resolveManifestProducer.
  const { ast } = parse(source, { filename: FILENAME });
  const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename: FILENAME,
  });

  it('lowerToIR emits zero error diagnostics', () => {
    const errs = lowerDiags.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('component name matches', () => {
    expect(ir.name).toBe(EXPECT.name);
  });

  it('props surface matches (18 props)', () => {
    const propNames = ir.props.map((p: { name: string }) => p.name);
    expect(sorted(propNames)).toEqual(sorted(EXPECT.props));
  });

  it('model:true props match (open + query — two models, no Angular CVA)', () => {
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    expect(sorted(modelNames)).toEqual(sorted(EXPECT.models));
  });

  it('emits surface matches (select/navigate/back/action-select)', () => {
    expect(sorted(ir.emits)).toEqual(sorted(EXPECT.emits));
  });

  it('declares the option/empty/footer + icon/trailing/actions + loading/error/breadcrumb/actionItem/groupHeading/argsField slots (12)', () => {
    const slotNames = ir.slots.map((s: { name: string }) => s.name);
    expect(sorted(slotNames)).toEqual(sorted(EXPECT.slots));
  });

  it('D-07 byte-identity: composes via the STABLE specifier, never the relative form', () => {
    // Encodes the D-07 acceptance check at the source level: the authored file is
    // byte-identical between Option B (vendored) and a future Option A (published).
    // Only the codegen vendor-remap + the D-04 drift guard are B-specific.
    expect(source).toContain(`'${STABLE_COMBOBOX_SPECIFIER}'`);
    expect(source).not.toContain(`'${RELATIVE_COMBOBOX_SPECIFIER}'`);
  });

  it('expose surface matches (show/close/toggle/focus/openTo/goBack)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(sorted(exposeNames)).toEqual(sorted(EXPECT.expose));
  });

  it('the OPEN verb is `show`, not `open` (would collide with the open model)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('open');
    expect(exposeNames).toContain('show');
  });

  it('the POP verb is `goBack`, not `back` (would collide with the `back` emit, ROZ121)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(exposeNames).not.toContain('back');
    expect(exposeNames).toContain('goBack');
    expect(ir.emits).toContain('back');
  });

  it('no expose-verb collides with an emit (ROZ121 — proves goBack≠back) or a React model setter (ROZ524)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    const emitSet = new Set(ir.emits);
    expect(exposeNames.filter((v: string) => emitSet.has(v))).toEqual([]);
    const modelNames = ir.props
      .filter((p: { isModel?: boolean }) => p.isModel)
      .map((p: { name: string }) => p.name);
    const setters = new Set(modelNames.map((m: string) => `set${m[0].toUpperCase()}${m.slice(1)}`));
    expect(exposeNames.filter((v: string) => setters.has(v))).toEqual([]);
  });

  it('the new `action-select` emit does not collide with any expose verb (ACT-MODEL — emit-only, no expose verb added by sub-actions)', () => {
    const exposeNames = ir.expose.map((e: { name: string }) => e.name);
    expect(ir.emits).toContain('action-select');
    expect(exposeNames).not.toContain('action-select');
    expect(exposeNames.filter((v: string) => v === 'action-select')).toEqual([]);
  });

  const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;
  it.each(TARGETS)('compile(%s) emits zero error diagnostics + non-empty code', (target) => {
    const r = compile(source, { target, filename: FILENAME });
    const errs = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
    expect(r.code.length).toBeGreaterThan(0);
  });
});

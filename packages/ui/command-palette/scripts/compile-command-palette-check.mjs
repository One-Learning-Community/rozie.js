/**
 * compile-command-palette-check.mjs — the live compile() collision/surface gate
 * for the CommandPalette family (run BEFORE any leaf work, the otp/captcha
 * discipline).
 *
 * Pure GLUE over the @rozie/core public API. Asserts:
 *   1. lowerToIR() + compile()×6 emit ZERO error-severity diagnostics.
 *      The DELIBERATE `focus` $expose verb is a warn-only ROZ137 (accepted Lit
 *      override), filtered out by the error-severity gate.
 *   2. The IR surface matches the contract exactly.
 *   3. The OPEN verb is `show` (NOT `open`) — an `open` verb would collide with
 *      the `open` MODEL on React (both collapse onto generated open/setOpen
 *      state, the $data/model-key == $expose-verb class). The POP verb is
 *      `goBack` (NOT `back`) — a `back()` expose verb would collide with the
 *      `back` EMIT (ROZ121: expose∩emits must be empty). All expose verbs are
 *      collision-checked against every emit + the React model setters.
 * THROWS (non-zero exit) on any drift. No compiler/emitter/IR change.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src/CommandPalette.rozie');
// Phase 75 (Option A): FILENAME must be the ABSOLUTE source path (not a bare
// relative label) so <components> producer resolution walks node_modules
// upward from command-palette/src regardless of the invoking process's cwd —
// resolveManifestProducer resolves from dirname(fromFile), not from cwd or
// resolverRoot (which feeds only the tsconfig-paths matcher).
const FILENAME = SRC;
const source = readFileSync(SRC, 'utf8');

const EXPECT = {
  name: 'CommandPalette',
  // Rule 1 fix (command-palette-levels Task 7): this EXPECT was ALSO stale on
  // `score` — leftover from before the pluggable-scorer prop landed (this
  // script isn't wired into any package.json script/CI job so drift goes
  // uncaught; kept in sync with tests/surface.test.ts by hand). Gained
  // `searchDebounce` (LVL-ASYNC). command-palette-sub-actions (ACT-MODEL/
  // ACT-TRIGGER) adds `actionKey` (default '$mod+k') + `closeOnAction`
  // (default true). command-palette-13-empty-home-view-first adds
  // `defaultItems` — the root empty/home-view prop (13 props total).
  // command-palette-portal-overlay adds `appendTo` — element-portal target
  // for the overlay root (default false = render in place) — 15 props total.
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
  ],
  models: ['open', 'query'],
  // command-palette-levels: gains `navigate` (a level was pushed) and `back`
  // (a level was popped). command-palette-sub-actions (ACT-MODEL): gains
  // `action-select` (a row action was chosen — payload `{ item, action }`).
  emits: ['select', 'navigate', 'back', 'action-select'],
  // D-05 (BREAKING): re-aligned to the combobox slot vocabulary —
  // `#item {item,active}` → `#option {option,index,active,selected,disabled}`.
  // command-palette-levels: gains `loading`/`error` (re-projected inside
  // combobox's #empty region) and `breadcrumb` (the depth>0 header, a panel
  // sibling OUTSIDE the combobox). command-palette-sub-actions (ACT-RENDER):
  // gains `actionItem` (scope `{ action, item, active, disabled }`) — NOT
  // `action-item` (hyphenated), which fails ROZ127 (Vue's
  // `defineSlots<{…}>()` can't emit an unquoted hyphenated object key). The
  // existing `actions` slot is KEPT (now doubles as the interactive
  // open-the-menu affordance). cp-adopts-combobox-groups: gains
  // `groupHeading` (scope `{ group }`) — the re-projected vendored
  // <Combobox>'s native section-heading slot. command-palette-inline-args
  // (ARGS-RENDER, feature #12) adds `argsField` (scope `{ item, arg, value,
  // setValue }`) — the args surface's per-field override slot — 12 total.
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
  // command-palette-levels: gains `openTo` (⌘P deep-link) + `goBack` (pop one
  // level — NOT `back`, which would collide with the `back` EMIT above,
  // ROZ121: expose∩emits must be empty). command-palette-sub-actions: NO new
  // expose verb (openActionMenu/closeActionMenu are internal-only).
  expose: ['show', 'close', 'toggle', 'focus', 'openTo', 'goBack'],
};

const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const setEq = (a, b) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// ── 1. lower + surface assertions ──────────────────────────────────────────
const { ast } = parse(source, { filename: FILENAME });
const { ir, diagnostics: lowerDiags = [] } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
const lowerErrs = lowerDiags.filter((d) => d.severity === 'error');
if (lowerErrs.length) fail(`lowerToIR errors:\n${lowerErrs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);

if (ir.name !== EXPECT.name) fail(`name: got ${ir.name}, want ${EXPECT.name}`);

const propNames = ir.props.map((p) => p.name);
if (!setEq(propNames, EXPECT.props)) fail(`props mismatch:\n  got:  ${propNames.sort().join(', ')}\n  want: ${[...EXPECT.props].sort().join(', ')}`);

const modelNames = ir.props.filter((p) => p.isModel).map((p) => p.name);
if (!setEq(modelNames, EXPECT.models)) fail(`model:true props: got [${modelNames.sort()}], want [${[...EXPECT.models].sort()}]`);

if (!setEq(ir.emits, EXPECT.emits)) fail(`emits mismatch:\n  got:  ${[...ir.emits].sort().join(', ')}\n  want: ${[...EXPECT.emits].sort().join(', ')}`);

const slotNames = ir.slots.map((s) => s.name);
if (!setEq(slotNames, EXPECT.slots)) fail(`slots mismatch: got [${slotNames.sort()}], want [${[...EXPECT.slots].sort()}]`);

const exposeNames = ir.expose.map((e) => e.name);
if (!setEq(exposeNames, EXPECT.expose)) fail(`expose mismatch: got [${exposeNames.sort()}], want [${[...EXPECT.expose].sort()}]`);

// OPEN verb must be `show`, not `open` (the model collision).
if (exposeNames.includes('open')) fail('expose verb `open` collides with the `open` MODEL — rename to `show`');

// POP verb must be `goBack`, not `back` (would collide with the `back` EMIT, ROZ121).
if (exposeNames.includes('back')) fail('expose verb `back` collides with the `back` EMIT — rename to `goBack`');
if (!exposeNames.includes('goBack')) fail('expected expose verb `goBack` (the pop imperative verb) — not found');

// event⇄verb (ROZ121) + model-setter (ROZ524) collision guard asserted directly.
const emitSet = new Set(ir.emits);
const verbEmitClash = exposeNames.filter((v) => emitSet.has(v));
if (verbEmitClash.length) fail(`expose-verb == emit collision (ROZ121): [${verbEmitClash.join(', ')}]`);
const modelSetters = new Set(modelNames.map((m) => `set${m[0].toUpperCase()}${m.slice(1)}`));
const verbSetterClash = exposeNames.filter((v) => modelSetters.has(v));
if (verbSetterClash.length) fail(`expose-verb == React model-setter collision (ROZ524): [${verbSetterClash.join(', ')}]`);

// ── 2. compile()×6 — collision gates surface here as error diagnostics ──────
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'];
for (const target of TARGETS) {
  const r = compile(source, { target, filename: FILENAME, resolverRoot: ROOT });
  const errs = r.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) fail(`compile(${target}) errors:\n${errs.map((d) => `  ${d.code} ${d.message}`).join('\n')}`);
  else if (!r.code || !r.code.length) fail(`compile(${target}) produced empty output with no diagnostics`);
}

if (process.exitCode) {
  console.error('\n✗ compile-command-palette-check FAILED');
} else {
  console.log(`✓ CommandPalette surface OK: ${EXPECT.props.length} props (${EXPECT.models.length} model) / ${EXPECT.emits.length} emit / ${EXPECT.slots.length} slots / ${EXPECT.expose.length} expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`);
}

#!/usr/bin/env node
/**
 * Bootstrap canonical fixtures for tests/dist-parity (Plan 06-06 / D-93).
 *
 * Run once when fixtures need refresh after a compiler change:
 *   pnpm --filter dist-parity bootstrap
 *
 * The committed fixture bytes ARE the contract. The parity test compares
 * each entrypoint's output (compile() / CLI / babel-plugin / unplugin) to
 * these exact bytes; any drift is a v1 trust-erosion violation.
 *
 * Trailing-newline normalization (D-93): bytes end with a single LF. If
 * compile()`.code` already ends with LF, write as-is; otherwise append one.
 * NO other normalization (no whitespace stripping, no map ignoring).
 *
 * React-only sidecars (.d.ts / .module.css / .global.css) are written when
 * compile() returns non-empty values for those fields.
 */
import { compile } from '@rozie/core';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const FIXTURES_DIR = resolve(HERE, '../fixtures');

// Phase 06.2 P3 (D-126): EXAMPLES extended 5 → 8 (TreeNode, Card, CardHeader
// added). Modal regenerates per the D-119 retrofit (additive — <components>{
// Counter } block + <Counter /> embed in body content area). Non-Modal
// existing fixtures (Counter / SearchInput / Dropdown / TodoList) MUST stay
// byte-identical — the parity gate enforces that contract automatically.
// Phase 07.2 Plan 06 — EXAMPLES extended 8 → 9 with ModalConsumer (the
// consumer-side dogfood that exercises Modal's named + scoped slots).
// Multi-rozie examples (those referencing sibling .rozie producers via
// <components>) get an absolute filename + resolverRoot below so the IR
// cache + ProducerResolver can locate the sibling producers at compile time.
// Phase 07.3 Plan 09 — EXAMPLES extended 9 → 10 with WrapperModal so the
// consumer-side `r-model:open="$props.open"` forwarding pattern is byte-
// locked across all 4 entrypoints (compile/cli/babel/unplugin).
// Quick-task 260519-vyv (Spike 004) — EXAMPLES extended 10 → 11 with
// PortalListStyled, the canonical `@portal NAME { ... }` producer-side
// CSS-scoping fixture (single-file; no sibling .rozie producers).
// Phase 10 Plan 04 — EXAMPLES extended 11 → 12 with PortalListStyledScss, the
// SCSS proving fixture (a `<style lang="scss">` fork of PortalListStyled).
// Single-file; no sibling .rozie producers.
// Phase 10 test-coverage gap closure — EXAMPLES extended 12 → 13 with
// BadgeGridStyledScss, a SECOND SCSS proving fixture covering the
// PROGRAMMATIC SCSS surface PortalListStyledScss leaves untested:
// @if/@else, @each, @for, a @function, %placeholder + @extend, #{...}
// interpolation, and a Sass map via `@use 'sass:map'`. Single-file; no
// sibling .rozie producers.
// Phase 12 Plan 05 — EXAMPLES extended 13 → 15 with RModelLazy and
// RModelNumberTrim, the two built-in-only r-model-modifier fixtures
// (`.lazy` / `.number`+`.trim`). Registering a name here makes the
// bootstrap call compile() on it for all six targets (throwing on any
// error diagnostic) — this IS the SPEC AC-11 six-target compile proof
// for these fixtures. RModelCustom is deliberately NOT added: its
// `.phone` modifier is not in createDefaultRegistry() (the registry the
// bootstrap's compile() uses), so it would fail the bootstrap with an
// unknown-modifier error. It lives in tests/plugins/phone/examples/ (NOT
// in examples/) so the plain-registry examples/ build glob — the CLI
// runBuildMatrix and friends — never tries to compile it plugin-less.
// RModelCustom's AC-11 proof is instead the six
// tests/plugins/phone/src/__tests__/phone-<target>-emit.test.ts tests.
// All three are single-file; no sibling .rozie producers.
// Phase 13 — EXAMPLES extended 13 → 14 with ClassSelectorProbe ($classSelector
// proving fixture). The probe exercises `$classSelector` in BOTH a `<script>`
// call and a `:attr` binding, so registering it here makes the bootstrap
// compile() it across all six targets — the dist-parity proof that both
// rewrite hooks (rewriteScript.ts + rewriteTemplateExpression.ts) lower the
// helper byte-identically across all four entrypoints. Single-file; no
// sibling .rozie producers.
// Phase 14 — EXAMPLES extended 16 → 20 with the four attribute-fallthrough
// proving fixtures: ThemedButton (D-05/D-06 auto-fallthrough + CSS-custom-
// property style merge), ThemedButtonManual (R5 `inherit-attrs="false"`
// opt-out + manual `r-bind="$attrs"`), ThemedButtonConsumer (the consumer
// dogfood — multi-rozie, references both ThemedButton wrappers via
// <components>), and RBindProbe (R11d literal `r-bind` class-merge +
// reordered-source-order probe; single-file). ThemedButtonConsumer is
// added to EXAMPLES_NEEDING_RESOLVER_ROOT so the <components> import
// resolves at compile time. Registering all four here makes the bootstrap
// compile() them across all six targets — the dist-parity proof that
// `spreadBinding` (the new D-07 IR variant) lowers byte-identically across
// all four entrypoints and all six targets.
// Phase 15 — EXAMPLES extended 20 → 23 with the three new listener-
// fallthrough proving fixtures: ThemedButtonListenersManual (D-04 attrs-
// auto / listeners-manual corner — inherit-listeners="false" + manual
// r-on="$listeners"), ThemedButtonAllManual (D-05 attrs-manual /
// listeners-manual corner — both flags false + both manual directives),
// and ROnProbe (D-07 literal modifier-bearing + dynamic + R6 same-event
// source-order merge single-file probe). The existing ThemedButtonConsumer
// entry stays in EXAMPLES_NEEDING_RESOLVER_ROOT — it now composes all
// four wrappers via <components>. ThemedButtonListenersManual and
// ThemedButtonAllManual are LEAF producers (no <components> blocks) and
// do NOT need resolver-root. Registering all three here makes the
// bootstrap compile() them across all six targets — the dist-parity
// proof that `ListenerSpreadIR` (the new Phase 15 IR variant) lowers
// byte-identically across all four entrypoints and all six targets, and
// that the Plan 15-03/04/05 emitter changes propagate cleanly through
// every pre-existing fixture as well (master rebless wave).
// Phase 45 ($clone sigil) — EXAMPLES extended +1 with CloneProbe, the single-
// file $clone proving probe ($clone(x) → structuredClone(toRaw(x)) on Vue /
// $state.snapshot(x) on Svelte / structuredClone(x) on the other four, over
// nested reactive state containing a Date). Registering it makes the bootstrap
// compile() it across all six targets — the dist-parity proof that the six
// per-target lowering branches emit byte-identically across all four
// entrypoints. Rebless drift is confined to the new CloneProbe.* fixtures (+
// the FlowCanvas dogfood). Single-file; stays OUT of RESOLVER_ROOT. See the
// per-entry inline comment at the CloneProbe array slot below for the
// authoritative description (this cumulative ledger is being phased out in
// favor of those inline comments per IN-04).
const EXAMPLES = [
  'Counter',
  'SearchInput',
  'Dropdown',
  'TodoList',
  'Modal',
  'TreeNode',
  'Card',
  'CardHeader',
  'ModalConsumer',
  'WrapperModal',
  'PortalListStyled',
  'PortalListStyledScss',
  'BadgeGridStyledScss',
  'RModelLazy',
  'RModelNumberTrim',
  'ClassSelectorProbe',
  // Phase 14 attribute-fallthrough proving fixtures.
  'ThemedButton',
  'ThemedButtonManual',
  'ThemedButtonConsumer',
  'RBindProbe',
  // Phase 15 listener-fallthrough proving fixtures.
  'ThemedButtonListenersManual',
  'ThemedButtonAllManual',
  'ROnProbe',
  // Phase 16 R5 — prop-default coercion conformance fixture.
  // Six-shape PRIMITIVE / FACTORY default probe whose committed per-target
  // bytes are the dist-parity contract for the D-01 / D-02 per-target
  // emit-side coercion of `undefined → declaredDefault`. Single-file; no
  // sibling .rozie producers — does NOT go into RESOLVER_ROOT.
  'PropDefaultCoercion',
  // Phase 17 ::part() cross-shadow-DOM styling proving PAIR (SPEC-R8). PartCard
  // is the LEAF producer (template root tagged `part="body"` — SPEC-R3); on Lit
  // the `part="body"` is emitted into the shadow template, on the other 5
  // targets it is a benign standard HTML attribute. PartCardConsumer embeds
  // <PartCard> via a <components> block and styles its part across the shadow
  // boundary with a `PartCard::part(body)` rule — on Lit Plan 02 lowers this to
  // `rozie-part-card[data-rozie-s-<hash>]::part(body)` (the W3C-correct working
  // shape), on the 5 non-Lit targets Plan 03 drops it as a no-op (SPEC-R4a).
  // Registering both here makes the bootstrap compile() them across all six
  // targets (throwing on any error diagnostic) — the SPEC-R8 six-target compile
  // proof. PartCardConsumer is added to EXAMPLES_NEEDING_RESOLVER_ROOT below
  // (it references ./PartCard.rozie via <components>); PartCard is a LEAF
  // single-rozie producer and stays OUT of RESOLVER_ROOT (the same
  // ThemedButton-vs-ThemedButtonConsumer split).
  'PartCard',
  'PartCardConsumer',
  // UpdateExpression (`++`/`--`) regression probe. Exercises `$data.X++/--` and
  // model `$props.X++/--`; the committed per-target bytes are the dist-parity
  // contract that the UpdateExpression mutation routes through each target's
  // setter path (React setCount(prev => prev + 1), Solid setCount(count() + 1),
  // Angular this.count.set(this.count() + 1), Lit model write(prev => prev + 1))
  // identically across all four entrypoints. Single-file; no sibling .rozie
  // producers — stays OUT of RESOLVER_ROOT.
  'UpdateExpressionProbe',
  // Phase 23 (angular-cva-forms-integration) off-state byte-equality probe.
  // Single-model (one `value` String `model: true` prop). Its Angular leg is
  // compiled with `cva: false` (see FIXTURE_ANGULAR_CVA_OFF below + the cvaOff
  // spread in the compile loop), so the committed Angular fixture is the
  // suppressed-CVA shape and the parity test asserts it byte-identical across
  // all four entrypoints (the off-state proof). The other five targets are
  // unaffected by the flag. Single-file; no sibling .rozie producers — stays OUT
  // of RESOLVER_ROOT.
  'CvaOffState',
  // Phase 21 $expose dogfood (REQ-11). Typed input exposing reset()/focus() via
  // $expose({ reset, focus }). Its committed per-target bytes are the dist-parity
  // contract that each target lowers the imperative handle in its native idiom
  // (React forwardRef + useImperativeHandle + .types handle interface, Vue
  // defineExpose, Svelte instance exports, Solid callback ref, Angular/Lit public
  // methods) while STRIPPING the top-level $expose(...) directive. The D-03
  // byte-identity proof: registering ExposeProbe must drift ONLY the new
  // ExposeProbe.* fixtures — every non-$expose fixture stays byte-for-byte
  // unchanged. Single-file; composes nothing — stays OUT of RESOLVER_ROOT.
  'ExposeProbe',
  // Phase 24 (security-self-test-battery) D-11 — the single r-html enabling
  // fixture. One String `content` prop rendered raw via `r-html`; the committed
  // per-target bytes are the corpus the Plan-04 security batteries scan. Single
  // file; no sibling .rozie producers — stays OUT of RESOLVER_ROOT.
  'RHtml',
  // Phase 26 (portable-template-interpolation) D-08 — the dedicated object-
  // interpolation parity fixture. An untyped <data> object ({ a: 1, b: [2, 3] })
  // is interpolated in three positions (text node, :data-x attribute binding,
  // class interpolation). The Phase 26 annotateDisplayWrap gate (D-06/D-07)
  // WRAPs all three on the five non-Vue targets so each renders identical
  // 2-space pretty-printed JSON via rozieDisplay; Vue stays raw (native
  // toDisplayString already JSON-prints plain Array/Object). Registering it here
  // makes the bootstrap compile() it across all six targets — the SPEC-1/SPEC-4
  // byte-exact cross-target JSON-parity proof across all four entrypoints.
  // Single-file; no sibling .rozie producers — stays OUT of RESOLVER_ROOT.
  'ObjectInterp',
  // Phase 34 (css-engine-dom-escape-hatch) — the engine-DOM escape hatch
  // proving fixture. Exercises BOTH a flat `:root { --custom-prop }` block
  // (D-03 byte-identity canary, routes through the unchanged rootRules path)
  // AND a nested `:root { .sel { ... } }` engine block (D-01/D-04/D-06, bare
  // children emit UNSCOPED/global on all six targets, NO [data-rozie-s-*] scope
  // attr). Registering it here makes the bootstrap compile() it across all six
  // targets — the dist-parity proof that the Wave 2 engineRules emit arms lower
  // byte-identically across all four entrypoints: React emits a NON-EMPTY
  // .global.css containing `.cm-editor`; Lit emits `.cm-editor` in BOTH static
  // styles AND injectGlobalStyles; no target carries a scoped copy. Single-file;
  // no sibling .rozie producers — stays OUT of RESOLVER_ROOT.
  'EngineDomEscape',
  // 260608-sya (attr-binding-nullish-drop) — the nullish attribute-binding DROP
  // parity fixture. Three whole-value attribute bindings on a generic element:
  // (1) `:data-x="cond ? 'v' : null"` DROPS when false, (2)
  // `:aria-expanded="cond ? 'true' : 'false'"` STAYS "false" (never nullish),
  // (3) `:title="$data.maybeNull"` (null) DROPS — proving the fix is not
  // ternary-specific. Registering it here makes the bootstrap compile() it
  // across all six targets: the five non-Vue targets route the wrapped whole-
  // value binding through `rozieAttr` (drop sentinel on `v == null`), Vue stays
  // native (`:attr` already drops nullish). Single-file; no sibling .rozie
  // producers — stays OUT of RESOLVER_ROOT.
  'AttrNullishDrop',
  // Phase 36 (cross-component-context-primitive) R12 — the $provide / $inject
  // byte fixtures. Five single-file producer leaves: ThemeProvider
  // ($provide('theme', { get color, cycle })), ThemePassthrough (an unaware
  // <slot/> middle with ZERO provides/injects — its bytes are the empty-case
  // byte-identity proof: all 6 emitters early-return, no context machinery),
  // ThemeButton ($inject('theme')), and the Tabs/Tab showcase pair. The
  // composer demos (ThemeContextDemo / TabsDemo) live in examples/demos/ and
  // are VR-only (the 6/6 behavioral cell), NOT dist-parity — same split as
  // PortalListDemo. Single-file leaves; stay OUT of RESOLVER_ROOT.
  'ThemeProvider',
  'ThemePassthrough',
  'ThemeButton',
  'Tabs',
  'Tab',
  // Phase 45 ($clone sigil) — the single-file $clone proving probe. $clone(x)
  // lowers per-target: structuredClone(toRaw(x)) (Vue) / $state.snapshot(x)
  // (Svelte) / structuredClone(x) (React/Solid/Angular/Lit), over nested
  // reactive state containing a Date. Drift on rebless is confined to the new
  // CloneProbe.* fixtures (+ the FlowCanvas dogfood). Single-file; no sibling
  // .rozie producers — stays OUT of RESOLVER_ROOT.
  'CloneProbe',
  // Phase 46 (ITEM-2) — the bare-boolean-attr-on-a-component proving PAIR.
  // BareAttrChild is the LEAF producer (declares a `combobox` Boolean prop).
  // BareAttrComponent is the consumer dogfood: it mounts <BareAttrChild combobox />
  // (a bare value-less attr on a COMPONENT — the Phase-46 IR coercion lowers it
  // to a `booleanLiteral(true)` binding so every target passes a real `true`,
  // NOT a falsy `""`) ALONGSIDE a `<div hidden></div>` (a bare attr on a DOM
  // element — stays a static `hidden=""`, proving the coercion is gated strictly
  // on component-ness). Registering both makes the bootstrap compile() them
  // across all six targets — the dist-parity proof that the coercion lowers
  // byte-identically across all four entrypoints with ZERO per-target emitter
  // edits. BareAttrComponent is added to EXAMPLES_NEEDING_RESOLVER_ROOT (it
  // references ./BareAttrChild.rozie via <components>); BareAttrChild is a LEAF
  // single-rozie producer and stays OUT of RESOLVER_ROOT.
  'BareAttrChild',
  'BareAttrComponent',
  // Phase 54 (rozie-script-partials-rzts-rzjs) Wave-0 — the inline-vs-partial
  // byte-identity PAIR. PartialInlineHost imports `{ usedName }` from the
  // sibling script partial ./partialLogic.rzts; the compiler inlines that
  // exported $computed (+ its transitive `double` helper + the hoisted `clamp`
  // value import) into the host script before lowering, tree-shaking the unused
  // `neverUsed` export. InlineEquivHost carries the SAME logic written inline —
  // the byte-identity oracle. Their per-target emit MUST be byte-identical after
  // normalizing only the component identifier token (asserted by
  // tests/dist-parity/partial-inline-parity.test.ts). PartialInlineHost
  // references a sibling .rzts and is added to EXAMPLES_NEEDING_RESOLVER_ROOT
  // below; InlineEquivHost is single-file and stays OUT of RESOLVER_ROOT.
  // NOTE: these fixtures CANNOT be blessed until the inline pass lands — the
  // bootstrap compile of PartialInlineHost throws until then. Plan 05 enables
  // the pass, runs bootstrap, and un-skips the parity test.
  'PartialInlineHost',
  'InlineEquivHost',
  // Phase 55 (script-partial-literal-byte-identity) — the COMMENT-BEARING
  // analog of the PartialInlineHost/InlineEquivHost pair. partialLogicC.rzts
  // carries leading / between-statement / trailing comments on its surviving
  // declarations, so the inline splice exercises @babel/generator's
  // comment-adjacency + blank-line math at the host↔partial boundary — the path
  // the comment-FREE Phase 54 pair cannot reach. PartialInlineHostC references a
  // sibling .rzts and is added to EXAMPLES_NEEDING_RESOLVER_ROOT below;
  // InlineEquivHostC is single-file and stays OUT of RESOLVER_ROOT.
  // NOTE: these fixtures are NOT blessed in Plan 01 (no committed per-target
  // output) — the literal byte-identity drift would be baked in today. Plan 02
  // lands normalizeSplicedEmitLines, then blesses + un-skips the parity gate.
  'PartialInlineHostC',
  'InlineEquivHostC',
  // Phase 55 quick-task (WR-01) — the HETEROGENEOUS-BLOCK analog of the
  // PartialInlineHost pairs. partialOuterD.rzts FRESHLY HOISTS `{ clampD }` from a
  // plain .js module the host does NOT import AND imports `{ inner }` from a nested
  // ./partialInnerD.rzts (a partial-of-partial), so the inline splice mixes a
  // file-top hoist with decls from two different source files — the shape the
  // pre-fix single-offset block over-shifted (a spurious blank line on whole-program
  // targets like Solid). PartialInlineHostD references siblings and is added to
  // EXAMPLES_NEEDING_RESOLVER_ROOT below; InlineEquivHostD is single-file and stays
  // OUT. The .rzts/.js partials are LEAF sources consumed only via inline — not
  // EXAMPLES entries.
  'PartialInlineHostD',
  'InlineEquivHostD',
  // Phase 56 (script-partial-cross-target-comment-placement-parity) — the GAP-0
  // (R2) originalGap host-seam GREEN-×6 regression guard. partialLogicF.rzts places
  // its FIRST surviving declaration ZERO blank lines below the partial's own hoisted
  // import; by the extraction rule that partial-local delta equals the host-side
  // `tickF` → spliced-run delta, so measureOriginalGap returns 1 and the spliced run
  // flows zero blanks below the host const (the originalGap host-seam path, D-02).
  // The fixtures are COMMENT-FREE on the surviving decls: gap-0's COMMENT byte
  // manifestation is entangled with the comment-placement bugs plans 56-02/03/04 own,
  // so the comment-bearing red→green demonstration is DEFERRED to a later plan; this
  // guard isolates the blank-line arithmetic alone and stays GREEN ×6.
  // PartialInlineHostF references a sibling .rzts and is added to
  // EXAMPLES_NEEDING_RESOLVER_ROOT below; InlineEquivHostF is single-file and stays
  // OUT. The .rzts partial is a LEAF source consumed only via inline — not an
  // EXAMPLES entry.
  'PartialInlineHostF',
  'InlineEquivHostF',
  // Phase 56 (script-partial-cross-target-comment-placement-parity) — the
  // TRAILING-SEAM (R1) red→green guard. partialLogicE.rzts's last surviving decl
  // (`usedNameE`) is spliced into the host and trails DIRECTLY into an INLINE
  // (non-extracted) host const `hostTailE` that carries a LEADING comment. In the
  // inline oracle that comment is shared (predecessor's trailing + successor's
  // leading, one @babel comment object) so per-statement svelte/vue print it
  // TWICE; in the decomposed form the predecessor comes from the partial so the
  // host comment lives only on the successor's leading and prints ONCE — one copy
  // DROPPED on svelte/vue (RED) until the mirrorSpliceBoundaryComments trigger is
  // broadened to fire on the prev-is-spliced trailing seam. react/solid/angular/lit
  // are already byte-identical (whole-block/program dedup). PartialInlineHostE
  // references a sibling .rzts and is added to EXAMPLES_NEEDING_RESOLVER_ROOT below;
  // InlineEquivHostE is single-file and stays OUT. The .rzts partial is a LEAF
  // source consumed only via inline — not an EXAMPLES entry.
  'PartialInlineHostE',
  'InlineEquivHostE',
  // Phase 56 (script-partial-cross-target-comment-placement-parity) — the SHARED
  // MODULE-`let` (R3) BEFORE-side GREEN-×6 regression guard. partialLogicG.rzts /
  // partialLogicG2.rzts export comment-bearing arrow consts that splice as contiguous
  // runs DIRECTLY ABOVE sandwiched host `let`s that STAY in the host (rangeTransitionG
  // trails the spliced midDeclG; fillDragUpG trails the spliced beforeDeclG). The
  // authored comment LEADS each host `let` (before-side): prev is the spliced decl,
  // cur is the commented host `let` — the Plan 02 prev-spliced TRAILING-seam mirror
  // already restores the per-statement doubling on svelte/vue, so all six targets are
  // byte-identical here. NOTE: research assumption A3 (a solid/react "spurious SECOND
  // copy" at this seam) was empirically FALSIFIED — across five fixture shapes
  // solid/react NEVER double a shared comment at a sandwiched-let seam (whole-program
  // dedup + arrow→function conversion structurally collapse any duplicate), so there is
  // no solid/react break to suppress here. HostG ships as a permanent GREEN-×6 guard
  // that the before-side seam stays byte-neutral; the REAL isolated bug (after-side
  // host-`let`-trailing comment drop on svelte/vue) is guarded by HostI below.
  // PartialInlineHostG references a sibling .rzts and is added to
  // EXAMPLES_NEEDING_RESOLVER_ROOT below; InlineEquivHostG is single-file and stays OUT.
  // The .rzts partials are LEAF sources consumed only via inline — not EXAMPLES entries.
  'PartialInlineHostG',
  'InlineEquivHostG',
];

// Phase 23 (angular-cva-forms-integration) — per-fixture Angular CVA opt-out.
// Fixtures in this set are emitted with `angular: { cva: false }` for the
// Angular target ONLY, across all four entrypoints. The CvaOffState off-state
// probe proves cva:false suppresses ALL CVA emit byte-equally across the four
// entrypoints. Other single-model fixtures stay on the default-ON path. The set
// is keyed by fixture name; membership applies the cva:false option at compile
// time for the Angular target only.
const FIXTURE_ANGULAR_CVA_OFF = new Set(['CvaOffState']);

const EXAMPLES_NEEDING_RESOLVER_ROOT = new Set([
  'ModalConsumer',
  'WrapperModal',
  // Phase 14 — references ThemedButton + ThemedButtonManual via <components>.
  // Phase 15 — extended to reference all four ThemedButton variants via
  // <components> (ThemedButton + ThemedButtonManual +
  // ThemedButtonListenersManual + ThemedButtonAllManual). The two new
  // Phase 15 producers are LEAF single-rozie components and stay OUT of
  // RESOLVER_ROOT; only the multi-rozie Consumer needs it.
  'ThemedButtonConsumer',
  // Phase 17 — references ./PartCard.rozie via <components>; needs resolver
  // root so the IR cache + ProducerResolver locate the sibling producer at
  // compile time. The leaf producer PartCard stays OUT of RESOLVER_ROOT.
  'PartCardConsumer',
  // Phase 46 (ITEM-2) — references ./BareAttrChild.rozie via <components>;
  // needs resolver root so the IR cache + ProducerResolver locate the sibling
  // producer at compile time. The leaf producer BareAttrChild stays OUT of
  // RESOLVER_ROOT (the same ThemedButton-vs-ThemedButtonConsumer split).
  'BareAttrComponent',
  // Phase 54 — references ./partialLogic.rzts; needs resolver root so the
  // ProducerResolver locates the sibling partial at compile/inline time (same
  // pattern as PartCardConsumer). The .rzts partial is a LEAF source consumed
  // only via inline — it is NOT itself an EXAMPLES entry and stays OUT of
  // RESOLVER_ROOT. The single-file InlineEquivHost oracle also stays OUT.
  'PartialInlineHost',
  // Phase 55 — references ./partialLogicC.rzts; needs resolver root so the
  // ProducerResolver locates the sibling comment-bearing partial at
  // compile/inline time (same pattern as PartialInlineHost). The .rzts partial
  // is a LEAF source consumed only via inline — it is NOT an EXAMPLES entry and
  // stays OUT of RESOLVER_ROOT. The single-file InlineEquivHostC oracle also
  // stays OUT.
  'PartialInlineHostC',
  // Phase 55 quick-task (WR-01) — references ./partialOuterD.rzts (which in turn
  // references ./partialInnerD.rzts and ./wr01-helpers.js); needs resolver root so
  // the ProducerResolver locates the sibling partials at compile/inline time. The
  // .rzts/.js partials are LEAF sources consumed only via inline — NOT EXAMPLES
  // entries and OUT of RESOLVER_ROOT. The single-file InlineEquivHostD oracle also
  // stays OUT.
  'PartialInlineHostD',
  // Phase 56 — references ./partialLogicF.rzts; needs resolver root so the
  // ProducerResolver locates the sibling gap-0 partial at compile/inline time
  // (same pattern as PartialInlineHostC). The .rzts partial is a LEAF source
  // consumed only via inline — NOT an EXAMPLES entry and OUT of RESOLVER_ROOT.
  // The single-file InlineEquivHostF oracle also stays OUT.
  'PartialInlineHostF',
  // Phase 56 — references ./partialLogicE.rzts; needs resolver root so the
  // ProducerResolver locates the sibling trailing-seam partial at compile/inline
  // time (same pattern as PartialInlineHostC). The .rzts partial is a LEAF source
  // consumed only via inline — NOT an EXAMPLES entry and OUT of RESOLVER_ROOT.
  // The single-file InlineEquivHostE oracle also stays OUT.
  'PartialInlineHostE',
  // Phase 56 — references ./partialLogicG.rzts; needs resolver root so the
  // ProducerResolver locates the sibling shared-module-`let` partial at compile/inline
  // time (same pattern as PartialInlineHostC). The .rzts partial is a LEAF source
  // consumed only via inline — NOT an EXAMPLES entry and OUT of RESOLVER_ROOT. The
  // single-file InlineEquivHostG oracle also stays OUT.
  'PartialInlineHostG',
]);
// Phase 06.4 P3 (D-LIT-22): TARGETS extended with 'lit' — additive only.
const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

/** D-93 fixture extension table. */
function primaryExt(target) {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  if (target === 'solid') return '.solid.tsx';
  if (target === 'lit') return '.lit.ts';
  return `.${target}`;
}

function fixturePath(name, target, suffix) {
  const ext = suffix ?? primaryExt(target);
  return resolve(FIXTURES_DIR, `${name}${ext}`);
}

/** D-93: trailing-newline normalize at write-time only. No other processing. */
function normalize(s) {
  return s.endsWith('\n') ? s : `${s}\n`;
}

// Reset fixtures dir so stale outputs cannot linger across compiler changes.
if (existsSync(FIXTURES_DIR)) {
  for (const f of readdirSync(FIXTURES_DIR)) {
    rmSync(resolve(FIXTURES_DIR, f), { recursive: true, force: true });
  }
} else {
  mkdirSync(FIXTURES_DIR, { recursive: true });
}

let written = 0;
for (const name of EXAMPLES) {
  const sourcePath = resolve(ROOT, `examples/${name}.rozie`);
  const source = readFileSync(sourcePath, 'utf8');

  for (const target of TARGETS) {
    // Per Plan 06-06 §<action> Step C: types: true (D-90), sourceMap: false
    // (D-91 / T-06-06-03 — no absolute paths leak into committed bytes).
    // Phase 07.2 Plan 06 — multi-rozie examples need absolute filename +
    // resolverRoot so the IR cache + ProducerResolver locate sibling
    // .rozie producers (verified empirically that absolute-filename for
    // single-file examples is byte-equal to the relative form).
    const needsResolver = EXAMPLES_NEEDING_RESOLVER_ROOT.has(name);
    // Phase 23 — the off-state probe emits its Angular leg with cva:false so
    // the committed baseline is the suppressed-CVA shape. No-op on other targets.
    const cvaOff = target === 'angular' && FIXTURE_ANGULAR_CVA_OFF.has(name);
    const result = compile(source, {
      target,
      filename: needsResolver ? sourcePath : `${name}.rozie`,
      ...(needsResolver ? { resolverRoot: resolve(ROOT, 'examples') } : {}),
      ...(cvaOff ? { angular: { cva: false } } : {}),
      types: true,
      sourceMap: false,
    });
    const errs = result.diagnostics.filter((d) => d.severity === 'error');
    if (errs.length > 0) {
      const detail = errs.map((d) => `[${d.code}] ${d.message}`).join('; ');
      throw new Error(`bootstrap-fixtures: compile failed for ${name}/${target}: ${detail}`);
    }

    writeFileSync(fixturePath(name, target), normalize(result.code), 'utf8');
    written++;

    if (target === 'react') {
      if (result.types && result.types.length > 0) {
        writeFileSync(fixturePath(name, target, '.d.ts'), normalize(result.types), 'utf8');
        written++;
      }
      // Phase 25 de-CSS-Modules: React emits a side-effect `import './X.css'`,
      // so the scoped-CSS sidecar fixture is written to a PLAIN `.css` path
      // (was `.module.css`) — keeps the corpus consistent with the emitted
      // import + lets behavior tests that execute the .tsx resolve the sibling.
      if (result.css && result.css.length > 0) {
        writeFileSync(fixturePath(name, target, '.css'), normalize(result.css), 'utf8');
        written++;
      }
      if (result.globalCss && result.globalCss.length > 0) {
        writeFileSync(fixturePath(name, target, '.global.css'), normalize(result.globalCss), 'utf8');
        written++;
      }
    }
    process.stdout.write(`✓ ${name}.${target}\n`);
  }
}

process.stdout.write(`Bootstrap complete: ${written} fixture files written.\n`);

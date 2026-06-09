/**
 * lowerToIR — Phase 2's framework-neutral IR coordinator (Plan 02-05 Task 2).
 *
 * Single entrypoint Phase 3+ target compilers consume. Pipeline:
 *
 *   1. analyzeAST(ast) → bindings + diagnostics (Plan 02-02)
 *   2. buildReactiveDepGraph(ast, bindings) → depGraph (Plan 02-03)
 *   3. Per-block lowerers — props/data/script/listeners/template/slots/styles —
 *      each produces a typed IR fragment.
 *   4. Compose fragments into IRComponent.
 *
 * Per D-08 collected-not-thrown: NEVER throws on user input. Internal failures
 * push diagnostics; missing essential blocks return ir: null with diagnostics
 * populated.
 *
 * Per IR-04 / REACT-03: IRComponent.setupBody.scriptProgram === ast.script.program
 * (referential equality — no clone). Phase 3+ target emitters traverse + rewrite
 * this Babel File without re-parsing.
 *
 * Per D-22 / D-22b: opts.modifierRegistry must be a populated ModifierRegistry.
 * Use `createDefaultRegistry()` for the default builtin set.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { ReactiveDepGraph } from '../reactivity/ReactiveDepGraph.js';
import type { ModifierRegistry } from '../modifiers/ModifierRegistry.js';
import type { BindingsTable } from '../semantic/types.js';
import type { IRComponent, RefDecl, SetupBody, StyleSection } from './types.js';
import { analyzeAST } from '../semantic/analyze.js';
import { buildReactiveDepGraph } from '../reactivity/buildDepGraph.js';
import { lowerProps } from './lowerers/lowerProps.js';
import { lowerData } from './lowerers/lowerData.js';
import { lowerScript } from './lowerers/lowerScript.js';
import { lowerListeners } from './lowerers/lowerListeners.js';
import {
  lowerTemplate,
  synthesizeAttrsFallthrough,
  synthesizeListenersFallthrough,
} from './lowerers/lowerTemplate.js';
import { lowerComponents } from './lowerers/lowerComponents.js';
import { lowerSlots } from './lowerers/lowerSlots.js';
import { lowerStyles } from './lowerers/lowerStyles.js';
import { typeNeutralizeScript } from '../codegen/typeNeutralizeScript.js';
import { lowerRootElementRef } from './lowerers/lowerRootElementRef.js';
import { validateClassSelector } from './validateClassSelector.js';
import { validateSlotPropCollision } from './validateSlotPropCollision.js';
import { annotateDisplayWrap } from './annotateDisplayWrap.js';
import { validateRestoreFocus } from './validateRestoreFocus.js';
import { validateAttrFallthrough } from './validateAttrFallthrough.js';
import { validateListenerFallthrough } from './validateListenerFallthrough.js';
import * as t from '@babel/types';

/**
 * @experimental — shape may change before v1.0
 */
export interface LowerOptions {
  modifierRegistry: ModifierRegistry;
  /**
   * Phase 26 (D-11/D-12) — the GLOBAL `safeInterpolation` compiler option,
   * threaded from `CompileOptions.safeInterpolation` (and each `@rozie/unplugin`
   * pipeline). `annotateDisplayWrap` reads the EFFECTIVE flag, resolved in
   * `lowerToIR` with precedence:
   *
   *   `ast.blocks.rozie?.safeInterpolation ?? opts.safeInterpolation ?? true`
   *
   * i.e. the per-component `<rozie safe-interpolation="…">` envelope attribute
   * (Plan 06) wins over this global option, which wins over the `true` default.
   * When the effective flag is `false`, every interpolation/binding is emitted
   * raw (no `rozieDisplay` wrap). Absent here → falls through to the default.
   */
  safeInterpolation?: boolean;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface LowerResult {
  ir: IRComponent | null;
  diagnostics: Diagnostic[];
  depGraph: ReactiveDepGraph;
  bindings: BindingsTable;
}

/**
 * Build an empty SetupBody when the AST has no <script> block.
 *
 * Holds an empty Babel File so the IR-04 referential-preservation contract
 * remains a no-op rather than a special-case.
 */
function emptySetupBody(): SetupBody {
  return {
    type: 'SetupBody',
    scriptProgram: t.file(t.program([], [], 'module')),
    annotations: [],
  };
}

/**
 * Build an empty StyleSection when the AST has no <style> block.
 */
function emptyStyles(): StyleSection {
  return {
    type: 'StyleSection',
    scopedRules: [],
    rootRules: [],
    portalRules: [],
    engineRules: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

/**
 * Lower a parsed RozieAST into the framework-neutral RozieIR.
 *
 * @experimental — shape may change before v1.0
 *
 * @param ast - the RozieAST produced by parse()
 * @param opts - { modifierRegistry } — must be populated; createDefaultRegistry() for the default set
 */
export function lowerToIR(ast: RozieAST, opts: LowerOptions): LowerResult {
  // Run semantic analysis (collectors + 3 validators) first.
  const { bindings, diagnostics: semDiags } = analyzeAST(ast);
  const depGraph = buildReactiveDepGraph(ast, bindings);
  const diagnostics: Diagnostic[] = [...semDiags];

  // No content blocks at all → no IR (rare; parse() typically rejects sources
  // without a <rozie> envelope before this point).
  if (!ast.props && !ast.data && !ast.script && !ast.template && !ast.listeners && !ast.style) {
    return { ir: null, diagnostics, depGraph, bindings };
  }

  const props = ast.props ? lowerProps(ast.props, bindings, diagnostics) : [];
  const state = ast.data ? lowerData(ast.data, bindings, diagnostics) : [];

  const scriptResult = ast.script
    ? lowerScript(ast.script, bindings, depGraph, diagnostics)
    : { computed: [], lifecycle: [], watchers: [], setupBody: emptySetupBody(), emits: [], expose: [] };

  // RefDecl[] sourced from BindingsTable (template-collected refs).
  const refs: RefDecl[] = [];
  for (const entry of bindings.refs.values()) {
    refs.push({
      type: 'RefDecl',
      name: entry.name,
      elementTag: entry.elementTag,
      sourceLoc: entry.sourceLoc,
    });
  }

  const slots = ast.template ? lowerSlots(ast.template) : [];

  const listenersFromBlock = ast.listeners
    ? lowerListeners(ast.listeners, bindings, depGraph, opts.modifierRegistry, diagnostics)
    : [];

  // Phase 06.2 P1 D-115 — build the components table BEFORE template lowering
  // so lowerTemplate can annotate tagKind in a single pass.
  const componentsTable = lowerComponents(ast.components, diagnostics);

  const templateResult = ast.template
    ? lowerTemplate(
        ast.template,
        bindings,
        depGraph,
        opts.modifierRegistry,
        diagnostics,
        ast.name,
        componentsTable,
      )
    : { template: null, templateListeners: [] };

  const styles = ast.style ? lowerStyles(ast.style) : emptyStyles();

  const ir: IRComponent = {
    type: 'IRComponent',
    name: ast.name,
    props,
    state,
    computed: scriptResult.computed,
    refs,
    slots,
    emits: [...new Set(scriptResult.emits)],
    // Phase 21 — $expose({...}) method names in source order; [] when no
    // $expose call. NOT Set-deduped (per-name sourceLoc + source order must
    // survive); every emitter branches on expose.length === 0 (D-02).
    expose: scriptResult.expose,
    lifecycle: scriptResult.lifecycle,
    // Quick plan 260515-u2b — populated from $watch(getter, cb) calls.
    watchers: scriptResult.watchers,
    listeners: [...listenersFromBlock, ...templateResult.templateListeners],
    setupBody: scriptResult.setupBody,
    template: templateResult.template,
    // Phase 14 R5 — cross-framework attribute fallthrough. Threaded from the
    // `<rozie inherit-attrs>` attribute captured by splitBlocks onto
    // `BlockMap.rozie.inheritAttrs`. An absent attribute (key omitted under
    // exactOptionalPropertyTypes) lowers to the `true` default.
    inheritAttrs: ast.blocks.rozie?.inheritAttrs ?? true,
    // Phase 15 R5 — cross-framework LISTENER fallthrough. Threaded from the
    // `<rozie inherit-listeners>` attribute captured by splitBlocks onto
    // `BlockMap.rozie.inheritListeners`. INDEPENDENT of `inheritAttrs`. An
    // absent attribute (key omitted under exactOptionalPropertyTypes) lowers
    // to the `true` default.
    inheritListeners: ast.blocks.rozie?.inheritListeners ?? true,
    // Item 3 (engine-CSS shadow bridge) — threaded from the
    // `<rozie adopt-document-styles>` attribute captured by splitBlocks onto
    // `BlockMap.rozie.adoptDocumentStyles`. An absent attribute lowers to the
    // `false` default (opt-in). Only the Lit emitter consumes it (clone
    // document stylesheets into the shadow root); a no-op on the other 5
    // targets, so their emitted output is unchanged.
    adoptDocumentStyles: ast.blocks.rozie?.adoptDocumentStyles ?? false,
    styles,
    // Phase 06.2 P1 D-115 — populated from componentsTable.values() in source-order
    // (Map preserves insertion order per D-129).
    components: Array.from(componentsTable.values()),
    sourceLoc: ast.loc,
  };

  // Spike 001 B2 — synthesise a `__rozieRoot` RefDecl + root-element
  // `ref="__rozieRoot"` AttributeBinding when script context uses `$el`.
  // Mutates `ir` in place; no-op when $el is unused or root template is not
  // a single TemplateElement or already has a user-authored ref attribute.
  lowerRootElementRef(ir);

  // Type-neutralize the `<script>` AST so every target emits type-correct
  // TypeScript. The pass fills only the untyped residue and preserves author
  // annotations — non-trivial `<script>` logic (an engine instance in
  // `let editor = null`, untyped callback params) would otherwise emit
  // type-broken output on all six targets. This runs HERE — in lowerToIR —
  // rather than in compile() because `@rozie/unplugin` has its own
  // `parse → lowerToIR → emit{Target}` pipeline that bypasses compile();
  // lowering is the single point both paths share. Mutates
  // `ir.setupBody.scriptProgram` in place (IR-04: that program is the SAME node
  // as `ast.script.program`, but every emitter clones it before mutation, and
  // the annotations are exactly what each emitter needs).
  //
  // The pass is residue-only and `lang`-agnostic (WR-05): every visitor,
  // including the for-of `as any` wrap, fills only the syntactically-detected
  // untyped residue, so typed and untyped `<script>` blocks are handled
  // identically. See packages/core/src/codegen/typeNeutralizeScript.ts.
  typeNeutralizeScript(ir.setupBody.scriptProgram);

  // Phase 13 — validate every `$classSelector('<class>')` call (R3/R4/R5).
  // Runs HERE in lowerToIR rather than in compile() for the same reason as
  // typeNeutralizeScript above: `@rozie/unplugin` has its own
  // `parse → lowerToIR → emit{Target}` pipeline that bypasses compile(), and
  // lowering is the single chokepoint both paths share — one wiring site catches
  // a bad `$classSelector` call regardless of entrypoint. The validator needs
  // only `ir.styles` (no resolver / cache, unlike validateTwoWayBindings).
  // Collected-not-thrown (D-08): pushes ROZ965/966/967 diagnostics; never
  // mutates `ir`.
  validateClassSelector(ir, diagnostics);

  // Phase 28 — a `<slot name="X">` whose `X` equals a declared `<props>` key is
  // a HARD ERROR (ROZ127). Svelte 5 collapses snippets + props into one
  // `$props` namespace, so such a component compiles to a poisoned Svelte leaf
  // (duplicate `X` key) while the other 5 targets keep prop/slot in distinct
  // namespaces — a silent 1-of-6 divergence. Wired into this SAME lowerToIR
  // chokepoint (not compile()) so it fires for BOTH compile() AND
  // @rozie/unplugin. Local-IR-only (ir.slots vs ir.props) — no resolver/cache.
  // Collected-not-thrown (D-08): pushes ROZ127; never mutates `ir`.
  validateSlotPropCollision(ir, diagnostics);

  // Phase 26 (D-06/D-07) — resolve the wrap/raw `rozieDisplay` gate ONCE per
  // interpolation + attribute/class binding. Runs HERE in lowerToIR (not
  // compile()) for the same reason as typeNeutralizeScript / validateClassSelector
  // above: `@rozie/unplugin` has its own `parse → lowerToIR → emit{Target}`
  // pipeline that bypasses compile(), and lowering is the single chokepoint both
  // paths share — so all five non-Vue emitters (Plans 04/05) read ONE
  // pre-resolved `wrapForDisplay` boolean instead of re-deriving the type
  // analysis five times. Mutates the IR in place; never throws (D-08).
  //
  // Precedence (D-12): the per-component `<rozie safe-interpolation="…">`
  // envelope attribute (Plan 06) wins over the global `safeInterpolation`
  // compiler option, which wins over the `true` default. `ast.blocks.rozie?.
  // safeInterpolation` is read defensively via optional-chain — the splitter
  // does not populate it until Plan 06 lands, so it resolves to `undefined`
  // here and the global/default precedence applies.
  const effectiveSafeInterpolation =
    ast.blocks.rozie?.safeInterpolation ?? opts.safeInterpolation ?? true;
  annotateDisplayWrap(ir, effectiveSafeInterpolation);

  // Phase 16 — validate every `$restoreFocus('.sel', idx)` call (SPEC R9/R10).
  // Same chokepoint covers compile() AND @rozie/unplugin entrypoints.
  // Collected-not-thrown (D-08): pushes ROZ975/ROZ976 diagnostics; never
  // mutates `ir`.
  validateRestoreFocus(ir, diagnostics);

  // Phase 14 — validate cross-framework attribute fallthrough (R8/R9). Wired
  // directly after validateClassSelector — the same lowerToIR chokepoint both
  // compile() and @rozie/unplugin share, so a fallthrough problem is caught
  // regardless of entrypoint. Collected-not-thrown (D-08): pushes ROZ970
  // (multi-root error) / ROZ971 (double-apply warning); never mutates `ir`.
  validateAttrFallthrough(ir, diagnostics);

  // Phase 15 — validate cross-framework LISTENER fallthrough (R8/R9). The
  // parallel-functions sibling of validateAttrFallthrough per D-17. ROZ973
  // (multi-root error) and ROZ974 (double-apply warning) are INDEPENDENT of
  // ROZ970/ROZ971 per SPEC R8/R9 — the attrs-side and listeners-side checks
  // fire separately. Wired BEFORE synthesizeListenersFallthrough so the
  // synthesized bare-`\$listeners` spread is invisible to the validator (no
  // false-positive ROZ974 self-warning). Collected-not-thrown (D-08); never
  // mutates `ir`.
  validateListenerFallthrough(ir, diagnostics);

  // Phase 14 R4 / Plan 14-05 / RESEARCH.md Pattern 5 — synthesize the `$attrs`
  // auto-fallthrough `spreadBinding` onto the single root element when
  // `inheritAttrs !== false`. By the time this code runs, all six target
  // emitters can lower a `$attrs`-bearing `spreadBinding`:
  //   - React: `{...attrs}` via the `attrs` rest binding (Plan 14-03)
  //   - Solid: `{...attrs}` via splitProps rest (Plan 14-03)
  //   - Vue:   `v-bind="$attrs"` (template-native magic accessor, Plan 14-04)
  //   - Svelte: `{...$$restProps}` via Identifier rewrite (Plan 14-04)
  //   - Angular: effect()+Renderer2 applyAttrs (Plan 14-05 / D-01)
  //   - Lit:    rozieSpread directive (Plan 14-05 / D-02)
  //
  // Multi-root templates and `inherit-attrs="false"` skip synthesis (handled
  // inside synthesizeAttrsFallthrough); R8 (multi-root + inheritAttrs default)
  // emits ROZ970 via validateAttrFallthrough above.
  //
  // This un-gate completes the cross-framework attribute-fallthrough phase's
  // R4 requirement (auto-fallthrough by default). Plan 14-02 deferred this
  // call to 14-05; see 14-02-SUMMARY.md § Deviations (Rule 4) and
  // 14-05-PLAN.md cross-plan instructions for the full rationale.
  if (ir.template !== null) {
    synthesizeAttrsFallthrough(ir.template, ir.inheritAttrs);
    // Phase 15 R4 — listener-side mirror of synthesizeAttrsFallthrough.
    // Appends a bare-`\$listeners` ListenerSpreadIR onto the single
    // html-kind root when `inheritListeners !== false`. Multi-root and
    // `inherit-listeners="false"` skip synthesis (handled inside the
    // synthesizer); R8 (multi-root + inheritListeners default) emits
    // ROZ973 via validateListenerFallthrough above (which ran BEFORE this
    // synthesizer so the synthesized spread is not observed and the
    // ROZ974 R9 walk does not self-warn).
    synthesizeListenersFallthrough(ir.template, ir.inheritListeners);
  }

  return { ir, diagnostics, depGraph, bindings };
}

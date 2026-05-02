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
import { lowerTemplate } from './lowerers/lowerTemplate.js';
import { lowerSlots } from './lowerers/lowerSlots.js';
import { lowerStyles } from './lowerers/lowerStyles.js';
import * as t from '@babel/types';

/**
 * @experimental — shape may change before v1.0
 */
export interface LowerOptions {
  modifierRegistry: ModifierRegistry;
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
    : { computed: [], lifecycle: [], setupBody: emptySetupBody(), emits: [] };

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

  const templateResult = ast.template
    ? lowerTemplate(ast.template, bindings, depGraph, opts.modifierRegistry, diagnostics)
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
    lifecycle: scriptResult.lifecycle,
    listeners: [...listenersFromBlock, ...templateResult.templateListeners],
    setupBody: scriptResult.setupBody,
    template: templateResult.template,
    styles,
    sourceLoc: ast.loc,
  };

  return { ir, diagnostics, depGraph, bindings };
}

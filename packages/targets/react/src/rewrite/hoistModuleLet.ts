/**
 * hoistModuleLet — Plan 04-02 Task 2 (Wave 0 spike resolution).
 *
 * Detects module-scoped `let X = init` declarations referenced from a
 * LifecycleHook setup body (directly, or via ANY depth of top-level helper
 * call indirection — Plan 04-04 transitive promotion), auto-hoists them to a
 * `useRef(init)` inside the component body, and rewrites every reference
 * (read AND write) to `X.current`.
 *
 * Spike outcome (04-02-SPIKE.md): Modal.rozie's `let savedBodyOverflow = ''`
 * referenced by `lockScroll`/`unlockScroll` (top-level arrows passed
 * directly to $onMount/$onUnmount as Identifiers) is category (b) ONE-LEVEL
 * HELPER → AUTO-HOIST is feasible. Emits ROZ522 advisory.
 *
 * Detection rules (verbatim from 04-02-SPIKE.md):
 *   1. Top-level VariableDeclaration nodes with kind === 'let'
 *   2. Top-level helpers (const X = arrow|fn OR function X) → which
 *      module-lets they reference
 *   3. For each LifecycleHook:
 *      (a) setup is arrow/fn whose body references a module-let (directly or
 *          by calling a helper chain that does) → hoist
 *      (b) setup OR cleanup is Identifier matching a top-level helper whose
 *          TRANSITIVE call closure references a module-let → hoist
 *      (c) no reachable reference — leave UNHOISTED. (Plan 04-04 promoted the
 *          former one-level-only limit to the full transitive closure over the
 *          top-level helper call graph, so a let reached as
 *          `$onMount → handler → pushHistory → pushHistorySnapshot → stack`
 *          now hoists. Before, it stayed a per-render `let` — re-initialised
 *          to its `init` on every render — which silently broke any closure
 *          that captured a later render's copy, e.g. the live-read `$expose`
 *          handle reading an undo stack that was empty again.)
 *
 * For hoisted lets:
 *   - REMOVE the original `let X = init` from cloned Program top level
 *   - Synthesize HoistInstruction { name, initialExpr }
 *   - Rewrite ALL Identifier references to `X.current` MemberExpression
 *     (both reads and writes) anywhere in the cloned Program
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import type { File } from '@babel/types';
import type { IRComponent, TemplateNode } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

/**
 * OQ-2 (Phase 09 Plan 03) — resolve the TS type argument for a hoisted
 * module-let's synthesized `useRef<…>(…)` call from the declarator's
 * `typeAnnotation`.
 *
 * Returns:
 *   - the author's type rendered as source text when the declarator carries
 *     a real annotation (`let editor: Editor | null` → `'Editor | null'`),
 *   - `'any'` when the annotation is exactly the bare `: any` keyword (the
 *     `typeNeutralizeScript`-injected residue for a null/undefined-init'd
 *     untyped module-let — `useRef<any>(null)` keeps `.current` assignable),
 *   - `undefined` when the declarator has no annotation at all (emit a bare
 *     `useRef(…)`).
 *
 * Before Phase 09 this conflated "has an annotation" with "type is `any`":
 * once authors can type their `<script>` lets, that annotation IS the
 * author's type and emitting `any` would silently downgrade it.
 */
function resolveHoistTsType(declId: t.Identifier): string | undefined {
  const ann = declId.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return undefined;
  const inner = ann.typeAnnotation;
  // Exactly the bare `: any` keyword — the typeNeutralizeScript-injected case.
  if (t.isTSAnyKeyword(inner)) return 'any';
  // A real author type — render it to source text. `@babel/generator` prints
  // every TSType node natively.
  return generate(inner).code;
}

export interface HoistInstruction {
  name: string;
  initialExpr: t.Expression;
  /**
   * Rendered TS type argument for the synthesized `useRef<…>(…)` call, or
   * undefined to emit a bare `useRef(…)`.
   *
   * OQ-2 (Phase 09 Plan 03): this carries the AUTHOR's declared type when the
   * source `let` declarator was annotated (`let editor: Editor | null = null`
   * → `'Editor | null'`). When the declarator carried no annotation but
   * `typeNeutralizeScript` injected the bare `: any` residue (a
   * `null`/`undefined`-initialised UNTYPED module-let — the engine-wrapper
   * pattern), it is `'any'`: `useRef(null)` infers `RefObject<null>`, so
   * `editorRef.current = new Editor()` would be TS2322 — `useRef<any>(null)`
   * keeps it assignable. It is `undefined` only when the declarator has no
   * `typeAnnotation` at all.
   */
  tsType?: string;
}

export interface HoistResult {
  hoisted: HoistInstruction[];
  diagnostics: Diagnostic[];
}

/** Walk a function/arrow body and collect identifier references matching a name set. */
function collectIdentifierRefs(
  bodyNode: t.Node,
  candidateNames: ReadonlySet<string>,
): Set<string> {
  const found = new Set<string>();
  // The walker needs a Program-rooted path. BlockStatements lift directly
  // into the Program; a Statement node (e.g. a top-level `function X() {}`
  // declaration passed by step 2) is itself a valid Program member; only
  // genuine Expressions (Arrows / FnExprs / Identifiers) need wrapping in an
  // ExpressionStatement — wrapping a Statement crashes Babel's builder
  // validator ("Property expression … expected node to be of a type
  // ['Expression']").
  const programStmts: t.Statement[] = t.isBlockStatement(bodyNode)
    ? bodyNode.body
    : t.isStatement(bodyNode)
      ? [bodyNode]
      : [t.expressionStatement(bodyNode as t.Expression)];
  traverse(t.file(t.program(programStmts)), {
    Identifier(path) {
      if (!candidateNames.has(path.node.name)) return;
      const parent = path.parent;
      // Skip property positions of MemberExpressions: `obj.X` — that X
      // is a property, not a real reference.
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      // Skip ObjectProperty key positions when not shorthand.
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.shorthand) {
        return;
      }
      // Skip declaration-id positions.
      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
      if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
      if (t.isFunction(parent) && parent.params.includes(path.node)) return;
      // Skip import/export specifier identifier slots.
      if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
      if (t.isExportSpecifier(parent)) return;
      if (t.isLabeledStatement(parent) && parent.label === path.node) return;
      found.add(path.node.name);
    },
  });
  return found;
}

/**
 * Phase 73 item #11-b — collect every top-level HELPER NAME referenced
 * anywhere inside a template expression (attribute bindings, interpolation,
 * r-if/r-match tests + discriminant, r-for iterable/key, slot-invocation
 * args). A helper called ONLY from the template (never from a lifecycle
 * hook, watcher, or `$expose` verb) previously fell through `classifyExpr`
 * case (c) and any module-let it mutates stayed an un-hoisted per-render
 * `let` — the sortable-list `keyFor()`/`__rowKeySeq` gap
 * (`project_react_transitive_hoist_modulelet`, "EDGE found 2026-06-20").
 *
 * Deliberately does NOT walk `TemplateElementIR.events` (template `@event`
 * bindings) — those are unified into `ir.listeners` (D-20) and already feed
 * `escapingHelperNames` in emitScript.ts; a helper reachable ONLY via a
 * template event is therefore already accounted for as a lifecycle-adjacent
 * root elsewhere. This walker exists for the residual case: a helper called
 * from a plain BINDING expression (`:key`, `:data-id`, `{{ }}`, an `r-if`
 * test, a slot-invocation arg, …), which carries no such coverage.
 */
function collectTemplateReferencedHelperNames(
  node: TemplateNode | null,
  helperNames: ReadonlySet<string>,
): Set<string> {
  const found = new Set<string>();
  function visitExpr(expr: t.Expression | null | undefined): void {
    if (!expr) return;
    for (const n of collectIdentifierRefs(expr, helperNames)) found.add(n);
  }
  function visit(n: TemplateNode | null | undefined): void {
    if (!n) return;
    switch (n.type) {
      case 'TemplateElement': {
        for (const attr of n.attributes) {
          if (
            attr.kind === 'binding' ||
            attr.kind === 'twoWayBinding' ||
            attr.kind === 'spreadBinding'
          ) {
            visitExpr(attr.expression);
          } else if (attr.kind === 'interpolated') {
            for (const seg of attr.segments) {
              if (seg.kind === 'binding') visitExpr(seg.expression);
            }
          }
        }
        for (const spread of n.listenerSpreads) visitExpr(spread.expression);
        for (const c of n.children) visit(c);
        break;
      }
      case 'TemplateConditional': {
        for (const b of n.branches) {
          visitExpr(b.test);
          for (const c of b.body) visit(c);
        }
        break;
      }
      case 'TemplateMatch': {
        visitExpr(n.discriminant);
        for (const b of n.branches) {
          visitExpr(b.test);
          for (const c of b.body) visit(c);
        }
        if (n.hostElement) visit(n.hostElement);
        break;
      }
      case 'TemplateLoop': {
        visitExpr(n.iterableExpression);
        visitExpr(n.keyExpression);
        for (const c of n.body) visit(c);
        break;
      }
      case 'TemplateSlotInvocation': {
        for (const a of n.args) visitExpr(a.expression);
        for (const c of n.fallback) visit(c);
        break;
      }
      case 'TemplateFragment': {
        for (const c of n.children) visit(c);
        break;
      }
      case 'TemplateInterpolation': {
        visitExpr(n.expression);
        break;
      }
      case 'TemplateStaticText':
        break;
    }
  }
  visit(node);
  return found;
}

/**
 * OQ-2 (Phase 09 Plan 03) resolved `useRef<…>` shape carried through both the
 * analysis pass and the mutating hoist pass. Module-scope so both
 * `analyzeModuleLetReachability` and `hoistModuleLet` share one definition.
 */
type LetCandidate = {
  name: string;
  initialExpr: t.Expression;
  declStmt: t.VariableDeclaration;
  declIndex: number;
  declaratorIndex: number;
  sourceLoc: { start: number; end: number };
  /**
   * OQ-2: resolved `useRef<…>` type argument — the author's declared type
   * when annotated, `'any'` for the typeNeutralizeScript-injected bare
   * `: any` residue, `undefined` when the declarator carried no annotation.
   */
  hoistTsType: string | undefined;
};

export interface ModuleLetReachability {
  moduleLets: Map<string, LetCandidate>;
  /** Every module-let name reachable from a lifecycle hook / watcher /
   *  `$expose` verb / template-called helper — i.e. what WOULD be hoisted. */
  referencedLets: Set<string>;
}

/**
 * Pure analysis pass (no mutation): resolve which module-scoped `let`
 * declarations are reachable from a lifecycle hook, watcher, `$expose` verb,
 * or (Phase 73 item #11-b) a template-called helper — through any depth of
 * top-level helper-call indirection. Shared by the mutating `hoistModuleLet`
 * AND `getHoistableModuleLetNames` (Phase 73 item #9 — used by
 * `deconflictDeclareThenAssignRef` in rewriteScript.ts to decide whether a
 * capture-`let` colliding with a `ref="X"` name needs deconfliction even
 * without a direct `$refs.X` read, because it WILL be hoisted to its own
 * `useRef` regardless).
 */
function analyzeModuleLetReachability(
  program: File,
  ir: IRComponent,
): ModuleLetReachability {
  // 1. Collect module-let candidates: top-level VariableDeclaration with kind === 'let'.
  const moduleLets = new Map<string, LetCandidate>();
  program.program.body.forEach((stmt, idx) => {
    if (!t.isVariableDeclaration(stmt)) return;
    if (stmt.kind !== 'let') return;
    stmt.declarations.forEach((decl, declIdx) => {
      if (!t.isIdentifier(decl.id)) return;
      const init = decl.init ?? t.identifier('undefined');
      const start = stmt.loc?.start.index ?? 0;
      const end = stmt.loc?.end.index ?? 0;
      moduleLets.set(decl.id.name, {
        name: decl.id.name,
        initialExpr: init,
        declStmt: stmt,
        declIndex: idx,
        declaratorIndex: declIdx,
        sourceLoc: { start, end },
        hoistTsType: resolveHoistTsType(decl.id),
      });
    });
  });
  if (moduleLets.size === 0) return { moduleLets, referencedLets: new Set() };

  const moduleLetNames = new Set(moduleLets.keys());

  // 2. Catalogue EVERY top-level helper (name → body), independent of whether
  //    it directly touches a module-let — a helper that only CALLS another
  //    helper still participates in the transitive reachability graph below.
  const helperBodies = new Map<string, t.Node>();
  for (const stmt of program.program.body) {
    let helperName: string | null = null;
    let body: t.Node | null = null;

    if (t.isVariableDeclaration(stmt)) {
      // Treat the FIRST declarator as the helper if its init is an arrow/fn-expr.
      for (const d of stmt.declarations) {
        if (
          t.isIdentifier(d.id) &&
          d.init &&
          (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
        ) {
          helperName = d.id.name;
          body = d.init;
          break;
        }
      }
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      helperName = stmt.id.name;
      body = stmt;
    }
    if (!helperName || !body) continue;
    helperBodies.set(helperName, body);
  }
  const helperNames = new Set(helperBodies.keys());

  // 2b. For each helper compute (i) the module-lets it references DIRECTLY and
  //     (ii) the other helpers it CALLS. Then take the fixpoint over the call
  //     graph so `helperTransitiveLets[H]` holds every module-let reachable
  //     from H through ANY chain of helper calls. This is the Plan 04-04
  //     promotion: the original pass only resolved ONE level of helper
  //     indirection (case (b)), so a let reached as
  //     `$onMount → handler → pushHistory → pushHistorySnapshot → historyStack`
  //     fell through to case (c) and was left as a per-render `let` — fresh
  //     `[]` every render. Any closure that captured a LATER render (e.g. the
  //     live-read `$expose` handle) then read an empty stack. Transitive
  //     hoisting lifts the whole chain to `useRef`, restoring shared identity.
  const helperDirectLets = new Map<string, Set<string>>();
  const helperCalls = new Map<string, Set<string>>();
  for (const [name, body] of helperBodies) {
    helperDirectLets.set(name, collectIdentifierRefs(body, moduleLetNames));
    const calls = collectIdentifierRefs(body, helperNames);
    calls.delete(name); // a self-reference adds nothing to the closure
    helperCalls.set(name, calls);
  }
  const helperTransitiveLets = new Map<string, Set<string>>();
  for (const name of helperNames) {
    helperTransitiveLets.set(name, new Set(helperDirectLets.get(name)));
  }
  // Fixpoint iteration — terminates because the let universe is finite and
  // each pass only adds. Cycle-safe (a helper cycle just shares one set).
  let grew = true;
  while (grew) {
    grew = false;
    for (const name of helperNames) {
      const acc = helperTransitiveLets.get(name)!;
      for (const callee of helperCalls.get(name)!) {
        const calleeLets = helperTransitiveLets.get(callee);
        if (!calleeLets) continue;
        for (const l of calleeLets) {
          if (!acc.has(l)) {
            acc.add(l);
            grew = true;
          }
        }
      }
    }
  }

  // 3. Walk lifecycle hooks AND watchers → which lets are referenced via
  //     (a) / (a') / (b)? Watchers must participate because the common
  //     "round-trip guard" pattern (FullCalendar / Flatpickr / Leaflet)
  //     mutates a module-scoped let from the watcher and reads it from the
  //     mount-phase setup — both sides must agree on hoisting for the
  //     guard's value to persist across renders.
  const referencedLets = new Set<string>();
  for (const lh of ir.lifecycle) {
    classifyExpr(lh.setup);
    if (lh.cleanup) classifyExpr(lh.cleanup);
  }
  for (const wh of ir.watchers) {
    classifyExpr(wh.getter);
    classifyExpr(wh.callback);
  }
  // Phase 61 Plan 05 risk B — `$expose` verb bodies are a reachability ROOT too.
  // An `ExposedMethod` carries only its NAME (the verb is a top-level helper in
  // the script program); the `useImperativeHandle` closure that emitScript mints
  // is a hook context NOT otherwise scanned here. So a module-let mutated ONLY
  // inside an exposed verb (`let nextId = 0; const show = () => { nextId++ }`,
  // `$expose({ show })`) previously fell through to case (c) and was left a
  // per-render `let` — reseeded to its init every render → duplicate ids. We
  // route each expose-verb NAME through `classifyExpr` as an Identifier, which
  // hits case (b) and pulls in the helper's TRANSITIVE module-lets. This is a
  // scope-completeness fix — NO rename.
  for (const ex of ir.expose ?? []) {
    classifyExpr(t.identifier(ex.name));
  }
  // Phase 73 item #11-b — a helper called ONLY from a template expression
  // (`:key="keyFor(item, index)"`, an `r-if` test, a slot-invocation arg, …)
  // is ALSO a reachability root, for the same reason as the `$expose` verb
  // roots above: it is never routed through a lifecycle hook or watcher, so
  // a module-let it mutates previously fell through to case (c) and stayed a
  // per-render `let` (sortable-list `keyFor()`/`__rowKeySeq` —
  // `project_react_transitive_hoist_modulelet`). Scope-completeness — NO rename.
  for (const name of collectTemplateReferencedHelperNames(ir.template, helperNames)) {
    classifyExpr(t.identifier(name));
  }

  /** Pull every let a body reaches: its DIRECT refs plus the transitive lets
   *  of every helper it calls (at any nesting depth inside the body). */
  function addBodyReachableLets(body: t.Node): void {
    for (const r of collectIdentifierRefs(body, moduleLetNames)) referencedLets.add(r);
    for (const h of collectIdentifierRefs(body, helperNames)) {
      const lets = helperTransitiveLets.get(h);
      if (lets) for (const l of lets) referencedLets.add(l);
    }
  }

  function classifyExpr(expr: t.Expression | t.BlockStatement): void {
    // (a) DIRECT — arrow/fn expression body references a let (or calls a
    //     helper chain that does).
    if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
      addBodyReachableLets(expr);
      return;
    }
    // (a') DIRECT — BlockStatement body (post-`extractCleanupReturn` lift,
    // the IR's `lh.setup` is the cleanup-trimmed BlockStatement directly).
    // Without this branch any `let` referenced inside a `$onMount(() => {
    // ...; return cleanupFn })` arrow falls through to case (c) and stays
    // unhoisted — its bare-identifier references then re-bind on every
    // React render, breaking the let's "module-scoped scratch state"
    // semantics (e.g. FullCalendar's `let suppressViewSync = false`).
    if (t.isBlockStatement(expr)) {
      addBodyReachableLets(expr);
      return;
    }
    // (b) HELPER — Identifier referring to a top-level helper. Now resolves
    //     the helper's TRANSITIVE lets, not just its direct ones.
    if (t.isIdentifier(expr) && helperTransitiveLets.has(expr.name)) {
      const refs = helperTransitiveLets.get(expr.name)!;
      for (const r of refs) referencedLets.add(r);
      return;
    }
    // (c) Anything else — conservative no-hoist.
  }

  return { moduleLets, referencedLets };
}

/**
 * Phase 73 item #9 — non-mutating reachability query used by
 * `deconflictDeclareThenAssignRef` (rewriteScript.ts) to decide whether a
 * capture-`let` colliding with a `ref="X"` name will be HOISTED by
 * `hoistModuleLet` (and therefore needs deconfliction to `X$local`) even
 * when it carries no direct `$refs.X` read anywhere in the program — the
 * chartjs case (`let chart` populated from `new Chart(...)`, never read via
 * `$refs.chart`, but still hoisted because it's referenced from a lifecycle
 * hook).
 */
export function getHoistableModuleLetNames(
  program: File,
  ir: IRComponent,
): Set<string> {
  return analyzeModuleLetReachability(program, ir).referencedLets;
}

/**
 * Auto-hoist module-scoped `let` declarations referenced from lifecycle setup
 * bodies. Mutates `program` in place.
 */
export function hoistModuleLet(program: File, ir: IRComponent): HoistResult {
  const diagnostics: Diagnostic[] = [];
  const { moduleLets, referencedLets } = analyzeModuleLetReachability(program, ir);
  if (moduleLets.size === 0) return { hoisted: [], diagnostics };
  if (referencedLets.size === 0) return { hoisted: [], diagnostics };

  // 4. Hoist: synthesize HoistInstructions, remove the let declarations,
  //    emit ROZ522, and rewrite all references to `X.current`.
  const hoisted: HoistInstruction[] = [];
  const indicesToRemove = new Set<number>();
  for (const name of referencedLets) {
    const c = moduleLets.get(name);
    if (!c) continue;
    hoisted.push({
      name: c.name,
      initialExpr: c.initialExpr,
      // OQ-2: emit the author's declared type as the `useRef<…>` argument
      // when present; fall back to the injected `: any` only when the
      // declarator was untyped (`c.hoistTsType` is `'any'`) — and to a bare
      // `useRef(…)` when the declarator carried no annotation at all.
      ...(c.hoistTsType !== undefined ? { tsType: c.hoistTsType } : {}),
    });
    // Mark the entire VariableDeclaration for removal IF every declarator
    // in it is a hoist target (the common case is single-declarator). For
    // mixed declarations, splice the specific declarator out.
    if (c.declStmt.declarations.length === 1) {
      indicesToRemove.add(c.declIndex);
    } else {
      c.declStmt.declarations.splice(c.declaratorIndex, 1);
    }
    diagnostics.push({
      code: RozieErrorCode.TARGET_REACT_MODULE_LET_AUTO_HOISTED,
      severity: 'info',
      message: `Module-scoped \`let ${name}\` referenced from a lifecycle hook was auto-hoisted to per-instance storage so each React instance keeps its own copy. Reads and writes to \`${name}\` are handled automatically — no action needed.`,
      loc: c.sourceLoc,
    });
  }

  // Remove single-declarator let statements by index (descending for safety).
  if (indicesToRemove.size > 0) {
    program.program.body = program.program.body.filter(
      (_, i) => !indicesToRemove.has(i),
    );
  }

  // 5. Walk again and rewrite all Identifier references to hoisted names
  //    into `name.current` MemberExpressions.
  const hoistedNames = new Set(hoisted.map((h) => h.name));
  // Identifiers we manufactured as the `.object` of a freshly-built
  // `name.current` MemberExpression — visiting these would double-rewrite
  // into `name.current.current`. Tracked via WeakSet keyed on node identity.
  const synthesizedIdentifiers = new WeakSet<t.Node>();
  if (hoistedNames.size > 0) {
    traverse(program, {
      Identifier(path) {
        if (synthesizedIdentifiers.has(path.node)) return;
        if (!hoistedNames.has(path.node.name)) return;
        const parent = path.parent;
        // Skip property positions.
        if (
          (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
          parent.property === path.node &&
          !parent.computed
        ) {
          return;
        }
        // ObjectProperty key positions:
        //   - non-shorthand `{ X: expr }` → the key is just a property name,
        //     not a reference; skip.
        //   - shorthand `{ X }` is BOTH key and value (same Identifier node).
        //     If the grandparent is an ObjectPattern (destructuring binding,
        //     e.g. `({ X }) => …` or `const { X } = obj`), this is a BINDING
        //     not a reference — skip. If the grandparent is an ObjectExpression
        //     (value position, e.g. `return { X }`), un-shorthand the property
        //     and rewrite the VALUE to `X.current`, leaving the key as `X`.
        if (t.isObjectProperty(parent) && parent.key === path.node) {
          if (!parent.shorthand) return;
          const grandparent = path.parentPath?.parent;
          if (t.isObjectPattern(grandparent)) return;
          // ObjectExpression value position: un-shorthand + rewrite value.
          // We mutate parent (replaceWith doesn't apply — the path is shared
          // between key and value in shorthand form, so replacing it would
          // also clobber the key). Mark the new object Identifier as
          // synthesized so the visitor skips it on its next descent —
          // otherwise it would re-rewrite into `name.current.current`.
          const synthObject = t.identifier(path.node.name);
          synthesizedIdentifiers.add(synthObject);
          parent.shorthand = false;
          parent.value = t.memberExpression(synthObject, t.identifier('current'));
          path.skip();
          return;
        }
        // Skip declaration-id positions.
        if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
        if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
        if (t.isFunction(parent) && parent.params.includes(path.node)) return;
        if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
        if (t.isExportSpecifier(parent)) return;
        if (t.isLabeledStatement(parent) && parent.label === path.node) return;
        // Skip identifiers nested ANYWHERE inside an ObjectPattern /
        // ArrayPattern (destructuring binding positions — function params,
        // `const { x } = …`, `[a, b] = …`). The shorthand-ObjectProperty
        // branch above catches the most common case directly; this guard
        // catches nested patterns (`{ x: { y } }`) and array-pattern
        // elements. AssignmentPattern default values (`{ x = expr }`) are
        // expressions, NOT bindings — those should still get rewritten,
        // so we stop the walk at AssignmentPattern.right.
        {
          let walker: typeof path.parentPath | null = path.parentPath;
          while (walker) {
            const node = walker.node;
            if (t.isObjectPattern(node) || t.isArrayPattern(node)) return;
            if (
              t.isAssignmentPattern(node) &&
              walker.parentPath?.node &&
              (t.isObjectProperty(walker.parentPath.node) ||
                t.isArrayPattern(walker.parentPath.node) ||
                t.isObjectPattern(walker.parentPath.node))
            ) {
              // We're inside an AssignmentPattern. If we descended via the
              // RIGHT (default value), it's an expression → keep rewriting.
              // If via the LEFT (the binding), skip.
              if (node.left === path.node || isAncestorVia(node, 'left', path.node)) {
                return;
              }
              break;
            }
            if (t.isFunction(node)) break;
            walker = walker.parentPath;
          }
        }

        // Lexical-scope shadowing: if a local binding (function param,
        // destructuring pattern, inner let/const) shadows the hoisted
        // name, the reference points at the LOCAL, not the (now-removed)
        // module-let. Skip the rewrite. After removing the module-let
        // declarations, the only remaining bindings for these names are
        // local — but Babel's scope cache is stale post-mutation, so we
        // do a manual ancestor walk looking for binding nodes that
        // introduce a local `name` shadow.
        if (hasShadowingBinding(path, path.node.name)) return;

        // Replace `X` → `X.current`.
        path.replaceWith(
          t.memberExpression(t.identifier(path.node.name), t.identifier('current')),
        );
        path.skip();
      },
    });
  }

  return { hoisted, diagnostics };
}

/**
 * Check whether `node` is reachable from `ancestor` exclusively via the
 * named property (e.g. an AssignmentPattern's `left` subtree). Used to
 * distinguish "this identifier is the binding side of `{ x = default }`"
 * from "this identifier is in the default expression side."
 */
function isAncestorVia(ancestor: t.Node, key: 'left' | 'right', target: t.Node): boolean {
  const seed = (ancestor as unknown as Record<string, unknown>)[key];
  if (!seed) return false;
  let found = false;
  function walk(n: t.Node | null | undefined): void {
    if (!n || found) return;
    if (n === target) { found = true; return; }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
      const v = (n as unknown as Record<string, unknown>)[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object' && 'type' in item) walk(item as t.Node);
        }
      } else if (v && typeof v === 'object' && 'type' in v) {
        walk(v as t.Node);
      }
    }
  }
  walk(seed as t.Node);
  return found;
}

/**
 * Returns true if `name` is bound by a local declaration that lexically
 * encloses `path`. Walks ancestors looking for function parameters
 * (including destructuring patterns) and inner `let`/`const`/`var`
 * declarations that introduce a shadowing binding.
 *
 * We do NOT rely on Babel's `path.scope.getBinding` here because the
 * scope cache is stale after the module-let declarations have been
 * spliced out of the Program body (step 4 above mutates the AST
 * without crawling). Manual ancestor inspection avoids the staleness.
 */
function hasShadowingBinding(path: { parentPath: ParentPathLike | null }, name: string): boolean {
  for (let walker: ParentPathLike | null = path.parentPath; walker; walker = walker.parentPath) {
    const node = walker.node;
    // Function boundary: check parameters (including destructured ones).
    if (t.isFunction(node)) {
      for (const param of node.params) {
        if (patternIntroducesBinding(param, name)) return true;
      }
      // Don't stop here — keep walking outer scopes.
    }
    // Block-scoped declarations inside the same scope.
    if (t.isBlockStatement(node) || t.isProgram(node)) {
      for (const stmt of node.body) {
        if (!t.isVariableDeclaration(stmt)) continue;
        for (const decl of stmt.declarations) {
          if (patternIntroducesBinding(decl.id, name)) return true;
        }
      }
    }
  }
  return false;
}

type ParentPathLike = {
  node: t.Node;
  parentPath: ParentPathLike | null;
};

/**
 * Returns true if a binding-pattern node (Identifier in simple cases,
 * ObjectPattern / ArrayPattern / AssignmentPattern / RestElement for
 * destructured forms) introduces a binding for `name`.
 */
function patternIntroducesBinding(pattern: t.Node, name: string): boolean {
  if (t.isIdentifier(pattern)) return pattern.name === name;
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (patternIntroducesBinding(prop.value as t.Node, name)) return true;
      } else if (t.isRestElement(prop)) {
        if (patternIntroducesBinding(prop.argument, name)) return true;
      }
    }
    return false;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el && patternIntroducesBinding(el, name)) return true;
    }
    return false;
  }
  if (t.isAssignmentPattern(pattern)) {
    return patternIntroducesBinding(pattern.left, name);
  }
  if (t.isRestElement(pattern)) {
    return patternIntroducesBinding(pattern.argument, name);
  }
  return false;
}

/**
 * emitScript — Solid target (P1 minimal implementation).
 *
 * Produces the body of the Solid functional component above the `return ( <JSX> );`.
 * P1 maps the IR's state/computed/lifecycle primitives to Solid equivalents.
 * P2 will add full $data/$props/$refs/$emit rewriting via @babel/traverse.
 *
 * Result shape mirrors React's EmitScriptResult but drops `lifecycleEffectsSection`
 * and `hasPropsDefaults` (Solid always uses splitProps; lifecycle goes inline).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { resolveComponentRefs } from '../../../../core/src/codegen/resolveComponentRefs.js';
import { isMutableLiteralFactoryDefault } from '../../../../core/src/codegen/propDefaultFactory.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import { rewriteRozieIdentifiers, rewriteRozieExpressionNode as rewriteNode } from '../rewrite/rewriteScript.js';
import { emitPortals } from './emitPortals.js';
import { emitContext } from './emitContext.js';
import { renderType, zeroValueFor } from './emitPropsInterface.js';
import { computeTsCastWrapText, unwrapTsCast } from '../../../../core/src/ast/unwrapTsCast.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: false,
};

// Used only when emitting the user-authored statement block with source maps.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * ROZ-cast-blindness fix — Solid emits each ComputedDecl's body via
 * `rewriteNode(c.body, ir)` directly from IR (never re-scanning the cloned
 * Program for the body itself), so there is no existing "find the cloned
 * declarator" seam to piggyback a cast lookup onto. This walks the cloned
 * (post-rewrite) Program's top level to find, for each `$computed`-bound
 * declarator name, the author's original TS wrapper (`as T` / `!` /
 * `satisfies T` / `<T>`) so `createMemo(...)` can be re-wrapped in it —
 * unwrapping through the wrapper before the CallExpression check so
 * `const label = $computed(() => ...) as string` is still recognized.
 */
function findClonedComputedCasts(
  clonedProgram: t.File,
): Map<string, { prefix: string; suffix: string }> {
  const casts = new Map<string, { prefix: string; suffix: string }>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init) continue;
      const call = unwrapTsCast(d.init);
      if (!t.isCallExpression(call)) continue;
      if (!t.isIdentifier(call.callee) || call.callee.name !== '$computed') continue;
      casts.set(d.id.name, computeTsCastWrapText(d.init, genCode));
    }
  }
  return casts;
}

/**
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Building the arrow as a Babel node (rather than string-templating
 * `() => ${genCode(body)}`) lets @babel/generator auto-wrap ObjectExpression
 * bodies in parens, so `$computed(() => ({ x: 1 }))` emits `() => ({ x: 1 })`
 * instead of `() => { x: 1 }` (which would parse as a BlockStatement with a
 * LabeledStatement and break the consumer).
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

/**
 * ROZ-cast-blindness fix — render a `$computed` callback body as a
 * `() => ...` arrow, re-applying the author's original TS wrapper (`as T` /
 * `!` / `satisfies T`) around the callback's RETURN VALUE rather than around
 * the whole `createMemo(...)` call. Solid's `createMemo()` returns an
 * `Accessor<T>` wrapper (read via `label()`) — casting THAT to `T` is a
 * genuine type error (TS2352, confirmed by the shape-matrix harness) that
 * ALSO breaks every downstream `label()` call-read (TS2349, "not callable").
 * Casting the return value keeps `Accessor<T>` intact while still typing the
 * produced value. No cast → byte-identical to plain `arrowBody(body)`.
 */
function renderComputedArrow(
  body: t.Expression | t.BlockStatement,
  cast: { prefix: string; suffix: string } | undefined,
): string {
  if (!cast || (cast.prefix === '' && cast.suffix === '')) {
    return arrowBody(body);
  }
  const inner = t.isBlockStatement(body) ? `(${arrowBody(body)})()` : genCode(body);
  return `() => (${cast.prefix}${inner}${cast.suffix})`;
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * 260712-kl1 — exact-AST-shape gate mirroring the `isMutableLiteralFactoryDefault`
 * / `isNullWidenedPropObjectLiteralCallArgTarget` predicate convention. Matches
 * ONLY a Babel `NullLiteral` prop default (`default: null`) — never `undefined`,
 * `void 0`, or any other falsy/nullish shape. Used to widen a model prop's
 * `createControllableSignal<T>` generic to `T | null` (see 260712-kb9's
 * NEW-controllable-null-default catalog entry).
 */
function isNullLiteralDefault(dv: t.Node | null): boolean {
  return t.isNullLiteral(dv);
}

/**
 * WR-01 fix (73-REVIEW.md, 73-10 gap-closure): collect every Identifier
 * binding name introduced by a declarator's `id` pattern — Identifier
 * directly, or recursively through ObjectPattern / ArrayPattern /
 * AssignmentPattern / RestElement for destructured forms (`const { timer } =
 * …`, `const [a, b] = …`). Mirrors the same recursive pattern-name walk
 * already used for `patternIntroducesBinding` in the React target's
 * `hoistModuleLet.ts`, but collects ALL names into `out` rather than testing
 * for one specific name.
 */
function collectPatternNames(pattern: t.Node, out: Set<string>): void {
  if (t.isIdentifier(pattern)) {
    out.add(pattern.name);
    return;
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) collectPatternNames(prop.value as t.Node, out);
      else if (t.isRestElement(prop)) collectPatternNames(prop.argument, out);
    }
    return;
  }
  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (el) collectPatternNames(el, out);
    }
    return;
  }
  if (t.isAssignmentPattern(pattern)) {
    collectPatternNames(pattern.left, out);
    return;
  }
  if (t.isRestElement(pattern)) {
    collectPatternNames(pattern.argument, out);
  }
}

/**
 * Top-level `let`/`const`/`var`/function-declaration binding names declared
 * directly in a BlockStatement's own statement list (not recursing into
 * nested blocks/functions — matches the depth at which a `$onMount` setup
 * body declares its mount-locals).
 *
 * WR-01 fix (73-REVIEW.md, 73-10 gap-closure): previously only recorded a
 * declarator name when `t.isIdentifier(decl.id)` was true, so a destructured
 * top-level mount-local (`const { timer } = engine.start();`) was silently
 * excluded — `cleanupReferencesSetupLocal` then missed it and fell back to
 * the buggy IIFE-wrapping path (TS2304, the original bug this mechanism was
 * meant to close). Route every declarator through `collectPatternNames` so
 * destructured forms are recognized too.
 */
function topLevelDeclaredNames(block: t.BlockStatement): Set<string> {
  const names = new Set<string>();
  for (const stmt of block.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        collectPatternNames(decl.id, names);
      }
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

/**
 * Free-identifier names referenced anywhere inside `node` (over-approximates —
 * property keys of non-computed member/object-property access are excluded;
 * everything else that walks by as an Identifier counts). Used only to detect
 * "does the teardown reference a mount-local", so a conservative
 * over-approximation is safe: at worst it takes the scope-preserving splice
 * path below when it wasn't strictly necessary, never the reverse.
 */
function collectReferencedNames(node: t.Node): Set<string> {
  const names = new Set<string>();
  const VISITOR_KEYS = (t as unknown as { VISITOR_KEYS: Record<string, string[]> }).VISITOR_KEYS;
  const visit = (n: unknown, parent: t.Node | null): void => {
    if (!n || typeof n !== 'object' || typeof (n as t.Node).type !== 'string') return;
    const current = n as t.Node;
    if (t.isIdentifier(current)) {
      if (parent) {
        if (t.isMemberExpression(parent) && parent.property === current && !parent.computed) return;
        if (t.isObjectProperty(parent) && parent.key === current && !parent.computed) return;
      }
      names.add(current.name);
      return;
    }
    const keys = VISITOR_KEYS[current.type] ?? [];
    for (const key of keys) {
      const child = (current as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) visit(c, current);
      } else {
        visit(child, current);
      }
    }
  };
  visit(node, null);
  return names;
}

/**
 * True when `cleanup`'s teardown references a mount-local declared at the
 * top level of `setup`'s own block — the exact shape backlog item #2
 * (`project_emitter_hardening_backlog`, 73-02) describes.
 */
function cleanupReferencesSetupLocal(setup: t.BlockStatement, cleanup: t.Expression): boolean {
  const declared = topLevelDeclaredNames(setup);
  if (declared.size === 0) return false;
  const referenced = collectReferencedNames(cleanup);
  for (const name of declared) {
    if (referenced.has(name)) return true;
  }
  return false;
}

/**
 * Convert `const X = (...args) => body` (or function expression) into
 * `function X(...args) { ... }` so the binding HOISTS. Returns the new
 * statement, or null when the input is not a single-declarator
 * arrow/function-expression initializer (left as-is by the caller).
 *
 * **Why hoist?** `createMemo` (from `$computed`) runs its callback EAGERLY at
 * component-setup time, and memos are emitted in `hookSection` — above the
 * user helpers in `userArrowsSection`. A `$computed` whose body calls a
 * user-authored helper (`stats = $computed(() => stripHtml($data.content))`)
 * therefore reads that helper before its `const` declaration runs → TDZ
 * `ReferenceError: Cannot access 'stripHtml' before initialization`. A
 * `function` declaration hoists to the top of the component-function scope,
 * so it is defined before any eager memo callback fires. This mirrors
 * `tryHoistArrowToFunction` in the React emitter (whose `useMemo` callback
 * has the same eager-evaluation property).
 *
 * Multi-declarator / non-arrow declarations are left untouched. `async` is
 * preserved via FunctionDeclaration's `async` flag; a concise-expression
 * arrow body is wrapped in `{ return <expr>; }`.
 */
function tryHoistArrowToFunction(stmt: t.Statement): t.Statement | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return null;

  const body: t.BlockStatement = t.isBlockStatement(init.body)
    ? init.body
    : t.blockStatement([t.returnStatement(init.body)]);

  const params = init.params.filter(
    (p): p is t.Identifier | t.Pattern | t.RestElement =>
      t.isIdentifier(p) ||
      t.isRestElement(p) ||
      t.isAssignmentPattern(p) ||
      t.isObjectPattern(p) ||
      t.isArrayPattern(p),
  );

  const fn = t.functionDeclaration(decl.id, params, body, false, init.async ?? false);
  // WR-01 ROOT CAUSE 2 — `function f() {}` cannot carry a type annotation on
  // its `id`, so hoisting `const f: (e: MouseEvent) => void = (e) => {…}` would
  // drop the author's declarator annotation. Re-project the declarator's
  // function-type onto the hoisted FunctionDeclaration's params + returnType so
  // the author's types survive (and the hoist — which fixes a real TDZ — is
  // preserved).
  reprojectDeclaratorFunctionType(decl.id, init, fn);
  // Inherit the original statement's `loc` + attached comments onto the
  // synthetic FunctionDeclaration. Without this the new node has no source
  // position, so @babel/generator (a) drops any user `<script>` comments
  // attached to the declaration, (b) falls back to default blank-line
  // spacing, and (c) loses the source-map mapping for these lines — Solid's
  // emitScript generates code + map in a single pass over `filteredStmts`,
  // so the synthetic node must carry position metadata.
  return t.inherits(fn, stmt);
}

/**
 * Phase 55-04 (literal byte-identity) — reproduce the inline-authored comment
 * doubling at a script-partial splice boundary.
 *
 * In an inline-authored `<script>`, a comment block BETWEEN two statements is
 * attached by `@babel/parser` to BOTH neighbours (the earlier statement's
 * `trailingComments` AND the later statement's `leadingComments`). The `.rzts`
 * script-partial splice instead attaches the boundary banner ONLY to the spliced
 * node's `leadingComments` — the preceding statement lives in a different source
 * file and so carries no matching trailing comment. Re-mirroring the spliced
 * node's leading comments back onto the preceding statement's trailing comments
 * restores the inline form byte-for-byte:
 *   - whole-program generation (Solid here) prints the (deduped) banner once AND
 *     gets the boundary blank line from `@babel/generator`'s `printJoin`
 *     `_lastCommentLine` path — a trailing comment on the previous statement is
 *     exactly what triggers the loc-delta blank-line insertion; and
 *   - per-statement generation (Vue/Svelte) doubles the banner (one copy as the
 *     previous statement's trailing, one as the next statement's leading).
 *
 * Fires ONLY at a genuine splice boundary: the current statement carries
 * `extra.__roziePartialOrigin` AND its leading comments are not ALREADY shared as
 * the previous statement's trailing comments (within-partial statement pairs
 * already share the same comment objects; host-only pairs are left exactly as
 * authored). MUST run before the arrow→function hoist — `t.inherits` does not
 * copy `extra`, so the spliced marker is only visible on the original nodes.
 */
function mirrorSpliceBoundaryComments(stmts: t.Statement[]): void {
  for (let i = 1; i < stmts.length; i++) {
    const cur = stmts[i]!;
    const prev = stmts[i - 1]!;
    const lead = cur.leadingComments;
    if (!lead || lead.length === 0) continue;
    const extra = cur.extra as Record<string, unknown> | undefined;
    const curSpliced = extra?.__roziePartialOrigin !== undefined;
    const prevExtra = prev.extra as Record<string, unknown> | undefined;
    const prevSpliced = prevExtra?.__roziePartialOrigin !== undefined;
    // Phase 56-R8 (gap-1 after-side seam): a HOST successor (`cur`, NOT spliced) sitting
    // ONE-OR-MORE intended blank lines below the spliced run (`prev`) carries the boundary
    // comment ONLY on its leadingComments. Whole-program generation gets the boundary
    // blank from a PREV-TRAILING comment (a host-successor LEADING comment alone never
    // triggers it), so mirror the SHARED comment objects onto prev's trailing —
    // @babel/generator dedups them to ONE printed copy and `normalizeSplicedEmitLines`
    // already shifted their `loc` to `prev.end + afterGap`, reproducing the blank. Gated
    // to the `cur.extra.__rozieAfterGap` marker so the gap-0 trailing seam (HostE), which
    // already prints the single leading comment with zero blank correctly, is untouched.
    if (!curSpliced) {
      if (prevSpliced && extra?.__rozieAfterGap !== undefined) {
        const prevTrail = prev.trailingComments;
        const lastLead = lead[lead.length - 1];
        if (prevTrail && prevTrail.length > 0 && prevTrail[prevTrail.length - 1] === lastLead) {
          continue;
        }
        prev.trailingComments = [...(prevTrail ?? []), ...lead];
      }
      continue;
    }
    const prevTrail = prev.trailingComments;
    const lastLead = lead[lead.length - 1];
    if (prevTrail && prevTrail.length > 0 && prevTrail[prevTrail.length - 1] === lastLead) {
      continue;
    }
    prev.trailingComments = [...(prevTrail ?? []), ...lead];
  }
}

/**
 * WR-01 ROOT CAUSE 2 — re-project an author function-type annotation written
 * on a `VariableDeclarator` `id` (`const f: (e: E) => R = …`) onto a rebuilt
 * `FunctionDeclaration` (which has no annotatable `id`). Each declarator-type
 * parameter type is copied onto the matching positional param of `fn`; the
 * declarator-type return type becomes `fn.returnType`.
 *
 * Idempotent / conservative: only fills a param that has NO `typeAnnotation`
 * already, and only when `id.typeAnnotation` is genuinely a `TSFunctionType`.
 */
function reprojectDeclaratorFunctionType(
  id: t.Identifier,
  init: t.ArrowFunctionExpression | t.FunctionExpression,
  fn: t.FunctionDeclaration,
): void {
  if (init.returnType) fn.returnType = init.returnType;
  if (init.typeParameters && !t.isNoop(init.typeParameters)) {
    fn.typeParameters = init.typeParameters;
  }
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return;
  const fnType = ann.typeAnnotation;
  if (!t.isTSFunctionType(fnType)) return;
  if (!fn.returnType && fnType.typeAnnotation) {
    fn.returnType = fnType.typeAnnotation;
  }
  const declParams = fnType.parameters;
  for (let i = 0; i < fn.params.length && i < declParams.length; i++) {
    const target = fn.params[i]!;
    const sourceParam = declParams[i]!;
    const sourceAnn =
      t.isIdentifier(sourceParam) || t.isRestElement(sourceParam)
        ? sourceParam.typeAnnotation
        : undefined;
    if (!sourceAnn || !t.isTSTypeAnnotation(sourceAnn)) continue;
    if (
      (t.isIdentifier(target) ||
        t.isObjectPattern(target) ||
        t.isArrayPattern(target) ||
        t.isRestElement(target)) &&
      !target.typeAnnotation
    ) {
      target.typeAnnotation = t.cloneNode(sourceAnn, true);
    }
  }
}

export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — when true, the shell must add
   * `import { render } from 'solid-js/web';` because the portals closure
   * uses Solid's imperative render API. The existing 'solid-js/web' import
   * (used for the component's main `render` mount call in the shell) is
   * already present, so this is informational — but kept distinct for
   * future emit shape evolution.
   */
  hasPortals: boolean;
  /**
   * Solid signal/memo/lifecycle declarations + user-authored helpers.
   */
  hookSection: string;
  /** Alias for hookSection (kept for structural parity with React's EmitScriptResult). */
  userArrowsSection: string;
  /**
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a single string, ready to splice at module top by the shell.
   * Empty when the script has no imports.
   */
  userImports: string;
  /**
   * Quick task 260521-mj9 — author-declared `<script lang="ts">`
   * statement-position `interface` / `type` declarations, each rendered as a
   * string. emitSolid routes these into the shell's module-scope interface
   * bucket so they land ABOVE the props interface. Without this hoist they
   * stay inside the component function body, where the module-scope props
   * interface cannot see them — a custom prop type (`kind?: Kind`) referencing
   * such a name fails with TS2304. Always empty for an untyped `<script>`, so
   * untyped emit is byte-identical.
   */
  hoistedTypeDecls: string[];
  /**
   * `const _merged = mergeProps({ step: 1, ... }, _props);\n` when non-model
   * props have declared defaults. Null when no non-model defaults exist.
   * Emitted before splitPropsCall in the shell so `local.*` gets defaults.
   */
  mergePropsCall: string | null;
  /**
   * Number of statement lines in hookSection (createSignal, createMemo, etc.).
   * Used by buildShell to compute where userArrowsSection starts in the output
   * so the script source map can be line-offset-adjusted correctly.
   */
  hookSectionLines: number;
  /**
   * Source map for user-authored statements, produced by @babel/generator with
   * sourceMaps:true. Maps positions in the generated userArrowsSection text back
   * to the original .rozie source lines. The shell adjusts this map's generated
   * line numbers by the userCodeLineOffset before composing the final map.
   * Null when there are no user statements or no filename was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Phase 36 ($provide) — `<__ctx_<key>.Provider value={…}>` open tags,
   * OUTERMOST key first (nested for multiple keys). buildShell wraps ONLY the
   * `jsxIndented` payload, leaving `return (` + the close-tail byte-untouched.
   * Empty when the component has no `$provide`.
   */
  providerOpen: string[];
  /**
   * Phase 36 ($provide) — `</__ctx_<key>.Provider>` close tags, in REVERSE
   * order so the nesting balances against `providerOpen`. Empty when no
   * `$provide`.
   */
  providerClose: string[];
  diagnostics: Diagnostic[];
}

export interface EmitScriptCollectors {
  solidImports: SolidImportCollector;
  runtimeImports: RuntimeSolidImportCollector;
  /** .rozie filename; when provided, enables per-statement source map generation. */
  filename?: string | undefined;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string | undefined;
}

export function emitScript(
  ir: IRComponent,
  collectors: EmitScriptCollectors,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _registry?: unknown,
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const hookLines: string[] = [];

  // Clone + rewrite the Babel program (P1: minimal rewrite).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // Spike 001 B1 + quick task 260521-mj9 — partition user-authored top-level
  // ImportDeclarations AND statement-position `interface`/`type` declarations
  // out of the rewritten Program body BEFORE the residual-body iteration.
  // Mutate `rewriteResult.rewrittenProgram.program.body` in place so downstream
  // iterations naturally see only the residual statements.
  //
  // `userImports` is surfaced as a string for the shell to splice at module
  // top — without this hoist imports would land inside the component function
  // body and produce TS1232.
  //
  // `hoistedTypeDecls` carries any `<script lang="ts">` statement-position
  // `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`. Left in the function
  // body they are out of scope of the MODULE-scope props interface
  // (`interface FooProps { kind?: Kind }`), so a custom prop type like `Kind`
  // referenced from that interface fails with TS2304. emitSolid routes the
  // rendered strings into the shell's module-scope bucket — mirroring
  // Angular/Lit, which already hoist these. Always empty for an untyped
  // `<script>`, so untyped emit stays byte-identical.
  const {
    userImports: userImportNodes,
    hoistedTypeDecls: hoistedTypeNodes,
    bodyStmts,
  } = partitionUserImports(rewriteResult.rewrittenProgram);
  rewriteResult.rewrittenProgram.program.body = bodyStmts;
  const userImports =
    userImportNodes.length > 0
      ? userImportNodes.map((imp) => genCode(imp)).join('\n') + '\n'
      : '';
  const hoistedTypeDecls = hoistedTypeNodes.map((decl) => genCode(decl));

  // Phase 36 — cross-component context ($provide/$inject). Reads the rewritten
  // value/fallback expressions from the rewritten program so a provided getter
  // over `$data.color` picks up the Solid-signal rewrite. Empty-gated (R12/D-5):
  // `contextEmit.hasContext` is false (and nothing is spliced/wrapped) when the
  // component has no $provide/$inject — existing fixtures stay byte-identical.
  // Lead the hookLines with the inject binders + `const __ctx_<key> =
  // rozieContext('<key>')` decls so the `<__ctx_<key>.Provider>` wrap (spliced
  // by shell.ts) and any consumer references resolve at the top of the body.
  const contextEmit = emitContext(
    ir,
    { solid: collectors.solidImports, runtime: collectors.runtimeImports },
    rewriteResult.rewrittenProgram,
  );
  if (contextEmit.injectLines.length > 0) {
    hookLines.push(...contextEmit.injectLines);
  }
  if (contextEmit.contextDecls.length > 0) {
    hookLines.push(...contextEmit.contextDecls);
  }

  // 1. createControllableSignal for model:true props (D-135).
  // 1b. mergeProps call for non-model props with declared defaults.
  //     Must be emitted in shell BEFORE splitPropsCall so `local.*` gets defaults.
  //
  // Phase 16 R1 / D-01 / D-02 — include null/NullLiteral defaults. The prior
  // `!t.isNullLiteral(p.defaultValue)` exclusion dropped `default: null` props
  // from mergeProps, leaving them as `undefined` for an empty consumer call.
  // SPEC R1 requires `undefined → declaredDefault` uniform across all 6
  // targets including for `default: null`. mergeProps preserves null as a
  // distinct value from undefined (mergeProps's right-hand `_props` wins ONLY
  // when its key is defined; an absent key falls through to the left-hand
  // defaults object). Factory invocation `(${raw})()` already gives D-02
  // once-per-instance behavior because mergeProps runs ONCE at component
  // setup — no additional caching needed (verified Plan 16-01 RESEARCH §
  // Standard Stack Solid finding).
  const nonModelDefaultProps = ir.props.filter(
    (p) => !p.isModel && p.defaultValue !== null,
  );
  let mergePropsCall: string | null = null;
  if (nonModelDefaultProps.length > 0) {
    collectors.solidImports.add('mergeProps');
    const defaultEntries = nonModelDefaultProps.map((p) => {
      const dv = p.defaultValue!;
      const raw = genCode(dv);
      // Spike-012 — only an array/object-LITERAL-body arrow (`() => []` /
      // `() => ({…})`) is a per-instance mutable-default FACTORY to invoke. A
      // `type: Function, default: () => {}` arrow is the default VALUE (matching
      // Vue/Angular/Lit); invoking it would pass its `void` result as the prop.
      const val = isMutableLiteralFactoryDefault(dv) ? `(${raw})()` : raw;
      // 260712-a09 (Pattern F) — an Object/Array-typed prop's literal default
      // entry (`options: {}` / `xs: []`) infers its OWN narrow literal type
      // (`{}` / `never[]`) inside the mergeProps({defaults}, _props) call.
      // mergeProps unions that literal type with `_props`'s declared
      // `Record<string, any>` / `any[]` type, so a read off `local.options`
      // types as `Record<string, any> | {}` — member/index access on the `{}`
      // alternative is TS2339/TS2345. Cast the default entry to the prop's
      // own rendered interface type (`renderType`) so mergeProps infers a
      // single collapsed member type.
      //
      // Scoped to the ACTUAL Pattern F shape — a mutable-literal-factory
      // default (`() => ({})` / `() => []`) — not merely an Object/Array
      // TYPE. An Object/Array-typed prop can also default to `null`
      // (`appendTo: { type: Object, default: null }`, flatpickr); casting
      // THAT `null` default to `Record<string, any>` is a genuine TS2352
      // (`null` doesn't sufficiently overlap the target type) — a real bug
      // caught by the leaf-tsconfig sweep, not present in the narrower
      // factory-default-only gate below.
      const ann = p.typeAnnotation;
      const isObjectOrArrayFactoryDefault =
        isMutableLiteralFactoryDefault(dv) &&
        ann.kind === 'identifier' &&
        (ann.name === 'Object' || ann.name === 'Array');
      const entryVal = isObjectOrArrayFactoryDefault ? `${val} as ${renderType(ann)}` : val;
      return `${p.name}: ${entryVal}`;
    });
    mergePropsCall = `const _merged = mergeProps({ ${defaultEntries.join(', ')} }, _props);\n`;
  }

  for (const p of ir.props) {
    if (!p.isModel) continue;
    collectors.runtimeImports.add('createControllableSignal');
    const setterName = 'set' + capitalize(p.name);
    // 260521-oao — a no-default model prop (notably a `required: true` model
    // prop) has no author `default:`. `createControllableSignal`'s
    // `defaultFallback` arg is typed `T` (non-optional), so a bare `undefined`
    // fails tsc. Seed it with the builtin zero-value for the prop's type. For
    // a required model prop `_props[key]` is always present so the signal is
    // always controlled and this seed is never observed.
    let dflt = zeroValueFor(p.typeAnnotation);
    if (p.defaultValue !== null) {
      const raw = genCode(p.defaultValue);
      // When the prop default is an array/object-literal-body factory arrow
      // (e.g. `default: () => []`), the `createControllableSignal` third arg
      // should be the *initial value* (the result of calling the factory), not
      // the factory itself — else TS infers T as the function type. A
      // `type: Function, default: () => {}` arrow is NOT a factory (Spike-012):
      // the arrow IS the value, so it stays un-invoked.
      if (isMutableLiteralFactoryDefault(p.defaultValue)) {
        dflt = `(${raw})()`;
      } else {
        dflt = raw;
      }
    }
    // Thread the prop's TS type to the call site so the resulting Signal<T>
    // doesn't widen to `never[]` / `unknown` when the default is an empty
    // factory result. Without this, `default: () => []` makes TS infer T as
    // `never[]`, which cascades to "Property 'X' does not exist on type
    // 'never'" everywhere the signal is read.
    const tsType = renderType(p.typeAnnotation);
    // 260712-kl1 — a literal `default: null` model prop (260712-kb9's
    // NEW-controllable-null-default catalog entry). `dflt` above is already
    // the string `"null"` for this shape (via `genCode`), but `tsType` alone
    // excludes `null` — the emitted `createControllableSignal<T>(..., null)`
    // fails TS2345 (`null` not assignable to `T`) under strictNullChecks.
    // Widen the generic to `T | null` ONLY for this exact-AST-shape (a Babel
    // `NullLiteral` default) — no other default shape is affected.
    const genericType = isNullLiteralDefault(p.defaultValue) ? `${tsType} | null` : tsType;
    hookLines.push(
      // 260521-oao — `_props as unknown as Record<string, unknown>`: a direct
      // `as Record<string, unknown>` cast fails (TS2352, missing index
      // signature) once the props interface carries a `required: true`
      // non-optional field. Routing through `unknown` is the cast TS itself
      // suggests and is sound here — `createControllableSignal` only ever does
      // string-keyed reads on the object.
      `const [${p.name}, ${setterName}] = createControllableSignal<${genericType}>(_props as unknown as Record<string, unknown>, '${p.name}', ${dflt});`,
    );
  }

  // 2. createSignal for each StateDecl (<data> entries).
  for (const s of ir.state) {
    collectors.solidImports.add('createSignal');
    const setterName = 'set' + capitalize(s.name);
    // Class 2 (Phase 65-02) — a NARROW-LITERAL `<data>` default makes
    // `createSignal` infer a too-narrow type that breaks every downstream read:
    //   `[]` → `Signal<never[]>`         → `.map`/`For each` → TS2339/TS2349/TS2769
    //   `{}` → `Signal<{}>`              → string-key index → TS7053
    //   `null` → `Signal<null>`          → `setX(<value>)`  → TS2322 ('null')
    // Emit an explicit type arg so the inference is widened — the same
    // `Array→any[]` / `Object→Record<string,any>` widening the prop renderer
    // (renderType) already applies, and mirrors createControllableSignal<T>
    // above. Narrow-literal ONLY: a non-empty literal, a call, or a factory is
    // well-inferred and stays byte-identical (no type arg).
    let stateTypeArg = '';
    if (t.isArrayExpression(s.initializer) && s.initializer.elements.length === 0) {
      stateTypeArg = '<any[]>';
    } else if (t.isNullLiteral(s.initializer)) {
      stateTypeArg = '<any>';
    } else if (
      t.isObjectExpression(s.initializer) &&
      s.initializer.properties.length === 0
    ) {
      stateTypeArg = '<Record<string, any>>';
    }
    hookLines.push(
      `const [${s.name}, ${setterName}] = createSignal${stateTypeArg}(${genCode(s.initializer)});`,
    );
  }

  // 3. createMemo for each ComputedDecl.
  // Rule 1 fix: rewrite $props/$data/$refs in the computed body before emitting.
  const clonedComputedCasts = findClonedComputedCasts(rewriteResult.rewrittenProgram);
  for (const c of ir.computed) {
    collectors.solidImports.add('createMemo');
    const rewrittenBody = rewriteNode(c.body, ir);
    // ROZ-cast-blindness fix — renderComputedArrow re-applies the author's
    // original TS wrapper around the callback's return value (see its doc).
    const cast = clonedComputedCasts.get(c.name);
    hookLines.push(`const ${c.name} = createMemo(${renderComputedArrow(rewrittenBody, cast)});`);
  }

  // Portal-slot primitive (Spike 003) — emit portal scaffolding just before
  // the lifecycle hooks so the `portals` closure exists when user code's
  // onMount runs. The closure references `props.XSlot`, `render` (from
  // 'solid-js/web'), and `onCleanup`.
  const portalsEmit = emitPortals(ir, collectors.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    collectors.solidImports.add('onCleanup');
    // Reactive portal slots hold scope in a createSignal (Phase 33 / REQ-20).
    if (portalsEmit.needsCreateSignal) collectors.solidImports.add('createSignal');
    // The `render` named import lives on 'solid-js/web', not 'solid-js'.
    // SolidImportCollector currently only emits 'solid-js' — wire a separate
    // shell field through the script-emit result for the web import line.
    hookLines.push(portalsEmit.setupLines);
  }

  // 4. onMount/onCleanup for each LifecycleHook.
  //
  // Rule 1 fix: when lh.setup is a BlockStatement, genCode() produces `{ ... }`
  // which Babel's generator renders as an object literal — invalid as a function
  // argument. Wrap BlockStatements in an arrow function.
  //
  // Callable-reference Expressions (Identifier from `$onMount(reset)`, MemberExpr
  // from `$onMount(obj.handler)`, or the rare paired `() => () => cleanup`) are
  // already function values — pass straight through.
  //
  // Any OTHER Expression is the unwrapped concise-body of `() => <expr>` —
  // extractCleanupReturn strips the arrow wrapper, leaving e.g. `reset()` as
  // `lh.setup`. Passing it through verbatim would emit `onMount(reset())` which
  // (a) calls reset() at registration instead of after mount, and (b) TDZs on
  // any `const` declared later in the emitted output (e.g. `const reset = ...`
  // lives in userArrowsSection AFTER hookSection). Wrap it back in an arrow.
  function lifecycleArg(node: t.Node): string {
    if (t.isBlockStatement(node)) {
      return arrowBody(node);
    }
    if (
      t.isIdentifier(node) ||
      t.isMemberExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isFunctionExpression(node)
    ) {
      return genCode(node);
    }
    // Generic Expression fallback — use arrowBody so ObjectExpression bodies
    // get auto-parenthesized.
    return arrowBody(node as t.Expression);
  }

  for (const lh of ir.lifecycle) {
    if (lh.phase === 'mount') {
      if (lh.cleanup) {
        // Paired mount+cleanup: wrap in onMount, call onCleanup inside.
        // Shape: onMount(() => { const _cleanup = setupFn(); if (_cleanup) onCleanup(_cleanup); })
        collectors.solidImports.add('onMount');
        collectors.solidImports.add('onCleanup');
        // Rule 1 fix: rewrite $props/$data/$refs in the setup body; wrap BlockStatement in IIFE.
        // 260712-a09 (Pattern D) — non-null-assert a DOM ref used as a direct
        // engine-init call argument (mount body only; see rewriteScript.ts).
        const rewrittenSetup = rewriteNode(lh.setup, ir, { nonNullRefCallArgs: true });
        // lh.cleanup is declared `Expression` on LifecycleHook (never a
        // BlockStatement); rewriteRozieExpressionNode's signature is broader
        // (shared with the BlockStatement setup-rewrite call above), so the
        // return type must be narrowed back for use as a bare call argument.
        const rewrittenCleanup = rewriteNode(lh.cleanup, ir) as t.Expression;

        // Fix #2 (73-02 emitter-hardening batch, project_emitter_hardening_backlog):
        // the IIFE below re-parents the setup body into its OWN function
        // scope, so a mount-local `let`/`const` it declares is out of scope
        // for the `onCleanup(cleanupCode)` sibling call (TS2304). When the
        // returned teardown actually references such a local, splice the
        // setup block's OWN statements directly into the outer
        // `onMount(() => { ... })` closure instead — no wrapping IIFE — so
        // the mount-local and the onCleanup(...) call share ONE scope.
        // Gated strictly to that shape: the non-block / no-shared-local path
        // (the `else` below) is UNCHANGED so the existing corpus
        // (SearchInput, Modal, the 06.4 onMount-arrow-cleanup regression
        // fixture) stays byte-identical.
        const sharesLocal =
          t.isBlockStatement(lh.setup) && cleanupReferencesSetupLocal(lh.setup, lh.cleanup);

        if (sharesLocal) {
          const setupStatements = (rewrittenSetup as t.BlockStatement).body;
          const onMountArrow = t.arrowFunctionExpression(
            [],
            t.blockStatement([
              ...setupStatements,
              t.expressionStatement(
                t.callExpression(t.identifier('onCleanup'), [rewrittenCleanup]),
              ),
            ]),
          );
          hookLines.push(
            genCode(
              t.expressionStatement(
                t.callExpression(t.identifier('onMount'), [onMountArrow]),
              ),
            ),
          );
        } else {
          const rawSetup = genCode(rewrittenSetup);
          const setupCall = t.isBlockStatement(lh.setup)
            ? `(() => ${rawSetup})()`
            : `(${rawSetup})()`;
          const cleanupCode = genCode(rewrittenCleanup);
          hookLines.push(
            `onMount(() => {\n` +
            `  const _cleanup = ${setupCall} as unknown;\n` +
            `  if (_cleanup) onCleanup(_cleanup as () => void);\n` +
            `  onCleanup(${cleanupCode});\n` +
            `});`,
          );
        }
      } else {
        collectors.solidImports.add('onMount');
        // 260712-a09 (Pattern D) — see the paired-cleanup branch above.
        const rewrittenSetup = rewriteNode(lh.setup, ir, { nonNullRefCallArgs: true });
        const arg = lifecycleArg(rewrittenSetup);
        hookLines.push(`onMount(${arg});`);
      }
    } else if (lh.phase === 'unmount') {
      collectors.solidImports.add('onCleanup');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`onCleanup(${arg});`);
    } else if (lh.phase === 'update') {
      // update phase: createEffect re-runs on tracked dependency change
      collectors.solidImports.add('createEffect');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`createEffect(${arg});`);
    }
  }

  // 4c. Quick plan 260515-u2b — $watch lowers to createEffect(() => { getter(); cb(); }).
  // Solid's createEffect auto-tracks reads inside its callback. We IIFE-invoke
  // the getter so its reactive reads subscribe the effect, then run the
  // callback inside `untrack(...)` so the callback fires on first run + on
  // re-trigger WITHOUT its own reads (or transitive helper reads) joining the
  // effect's dependency set.
  // Both bodies need rewriteNode (post-IR rewrite) so $props.X / $data.X /
  // $refs.X lower to the Solid-side idiom (props.X / dataX() / xRef).
  // The getter/callback fields in the IR are bodies (BlockStatement | Expression);
  // wrap each back into a Babel arrow expression, then run rewriteNode, then
  // genCode.
  //
  // Bug B fix (260519 linechart-watch-recreate) — without the `untrack`
  // wrapper, the callback's transitive reads land in the watcher's deps:
  // LineChart's `$watch($props.type)` callback calls `buildConfig()` which
  // reads `$props.data`, so the `type` watcher re-fired (destroying +
  // recreating the Chart.js instance) on every data tick. `untrack` confines
  // the watcher's dependency set to the getter's reads only — matching Vue's
  // `watch(getter, cb)` and Svelte's untrack-wrapped $watch callback.
  for (const wh of ir.watchers) {
    collectors.solidImports.add('createEffect');
    collectors.solidImports.add('untrack');
    const getterArrow = t.arrowFunctionExpression([], wh.getter);
    // Preserve the user-authored callback params (e.g. `(v) => ...`) so the
    // reconstructed arrow declares them; otherwise references inside the body
    // would be unbound. Pass the getter's evaluated value as the first arg so
    // the param actually has a binding at call time.
    const cbArrow = t.arrowFunctionExpression(wh.callbackParams, wh.callback);
    const rewrittenGetter = rewriteNode(getterArrow, ir);
    const rewrittenCb = rewriteNode(cbArrow, ir);
    const getterCode = genCode(rewrittenGetter);
    const cbCode = genCode(rewrittenCb);
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). Solid's idiomatic lazy form is
    // `on(deps, fn, { defer: true })`: `deps` runs once to establish tracking
    // but `fn` is skipped on the first run, then fires on each reference-`!==`
    // change. The new value arrives as `fn`'s first param, which we bind to `v`.
    // `{ immediate: true }` opts back into the eager initial fire via the
    // original `createEffect(() => {...})` shape (fires on registration).
    //
    // 0-param discipline (preserved): passing an arg to a 0-param callback is
    // runtime-safe but tsc flags TS2554 ("Expected 0 arguments, but got 1"), so
    // only bind the value into the call when the callback declares a param.
    if (wh.immediate) {
      const callArg = wh.callbackParams.length > 0 ? '__watchVal' : '';
      hookLines.push(
        `createEffect(() => { const __watchVal = (${getterCode})(); untrack(() => (${cbCode})(${callArg})); });`,
      );
    } else {
      collectors.solidImports.add('on');
      const callArg = wh.callbackParams.length > 0 ? 'v' : '';
      hookLines.push(
        `createEffect(on(() => (${getterCode})(), (v) => untrack(() => (${cbCode})(${callArg})), { defer: true }));`,
      );
    }
  }

  // 4b. Ref variable declarations: `let fooRef: HTMLElement | null = null;`
  // Solid uses plain let variables (not useRef objects) for DOM refs.
  // Using HTMLElement (not Element) so DOM properties like .style, .focus() are accessible.
  //
  // Phase 66 (D-2 Handle-INTERFACE route, SC-1): a ref pointing at a
  // `<components>`-composed CHILD types as the child's exported `<Name>Handle`
  // (the Solid child already declares `ref?: (h: <Name>Handle) => void`, so the
  // interface is the exact ref call surface). The shared core resolver returns
  // NOTHING for a DOM ref → the `dialog`/HTMLElement branch below runs unchanged
  // for every non-composed ref (inertness/byte-identity carve-out). The
  // `<Name>Handle` import is wired at the child-import synthesis (emitSolid.ts).
  const componentRefs = resolveComponentRefs(ir);
  for (const ref of ir.refs) {
    const componentLocalName = componentRefs.get(ref.name);
    if (componentLocalName !== undefined) {
      hookLines.push(`let ${ref.name}Ref: ${componentLocalName}Handle | null = null;`);
      continue;
    }
    // LB6 SEAM 1 — gated carve-out: a ref on a native `<dialog>` types to
    // HTMLDialogElement so `$refs.x.showModal()` / `.close()` are accessible.
    // Emitter-hardening backlog item #4 — extended to `img`/`ul`/`li`
    // (promoted from the dialog-only ternary to a switch; every other tag
    // keeps the byte-identical `HTMLElement | null` default).
    let domType = 'HTMLElement';
    switch (ref.elementTag.toLowerCase()) {
      case 'dialog':
        domType = 'HTMLDialogElement';
        break;
      case 'img':
        domType = 'HTMLImageElement';
        break;
      case 'ul':
        domType = 'HTMLUListElement';
        break;
      case 'li':
        domType = 'HTMLLIElement';
        break;
    }
    hookLines.push(`let ${ref.name}Ref: ${domType} | null = null;`);
  }

  // 5. Emit user-authored top-level statements from the rewritten program.
  //    Skip: $computed declarators (handled above), $onMount/$onUnmount calls.
  const residualStmts: t.Statement[] = [];
  for (const stmt of rewriteResult.rewrittenProgram.program.body) {
    // Skip $computed variable declarations.
    // ROZ-cast-blindness fix — `d.init` unwraps through any TS wrapper before
    // the CallExpression check, so a cast-typed `$computed` is stripped too
    // (its `createMemo(...)` re-emit already carries the cast — see above).
    if (t.isVariableDeclaration(stmt)) {
      const allComputed = stmt.declarations.every((d) => {
        if (!d.init) return false;
        const call = unwrapTsCast(d.init);
        return (
          t.isCallExpression(call) &&
          t.isIdentifier(call.callee) &&
          call.callee.name === '$computed'
        );
      });
      if (allComputed) continue;

      // Phase 36 — `const x = $inject('k', f?)` binders are COMPILE-TIME
      // directives consumed via ir.injects and re-emitted by emitContext as
      // `const x = useContext(rozieContext('k'))[ ?? f]` (led into hookLines).
      // Strip them from the residual body so the bare `$inject` identifier never
      // leaks as an undefined runtime ref.
      // ROZ132 cast-blindness fix — `d.init` unwraps through any TS wrapper
      // (`as T` / `!` / `satisfies T` / `<T>`) before the CallExpression check,
      // so `const theme = $inject('theme') as ThemeContext` is stripped too.
      const allInject =
        stmt.declarations.length > 0 &&
        stmt.declarations.every((d) => {
          if (!d.init) return false;
          const call = unwrapTsCast(d.init);
          return (
            t.isCallExpression(call) &&
            t.isIdentifier(call.callee) &&
            call.callee.name === '$inject'
          );
        });
      if (allInject) continue;
    }
    // Skip lifecycle call expressions.
    // ROZ-cast-blindness fix — unwrap `stmt.expression` through any TS wrapper
    // before the CallExpression check, so e.g. `$onMount(...) as void` /
    // `($provide(...) as void)` is still recognized as the sigil and stripped.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(unwrapTsCast(stmt.expression))) {
      const callee = (unwrapTsCast(stmt.expression) as t.CallExpression).callee;
      if (
        t.isIdentifier(callee) &&
        (callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate' ||
          // Quick plan 260515-u2b — $watch is consumed by the watcher loop above.
          callee.name === '$watch' ||
          // Phase 21 ($expose, REQ-8) — `$expose({...})` is a compile-time
          // directive consumed via `ir.expose`; STRIP it from the residual
          // body or it leaks as an undefined-`$expose` runtime reference.
          callee.name === '$expose' ||
          // Phase 36 — `$provide('k', v)` is consumed via ir.provides and
          // re-emitted by emitContext as the `<C.Provider value={…}>` JSX wrap
          // (spliced by shell.ts). Strip the directive so the bare `$provide`
          // ref never leaks as an undefined-identifier ReferenceError.
          callee.name === '$provide')
      ) {
        continue;
      }
    }
    residualStmts.push(stmt);
  }

  // Phase 55-04 — restore the inline-authored splice-boundary comment doubling
  // (and the boundary blank line) BEFORE the arrow→function hoist; `t.inherits`
  // drops `extra`, so the spliced marker is only visible on the originals here.
  mirrorSpliceBoundaryComments(residualStmts);

  // Hoist `const X = () => …` helpers to `function X() {…}` so they are defined
  // before any eagerly-evaluated `createMemo` callback in hookSection references
  // them (TDZ fix — see tryHoistArrowToFunction).
  const filteredStmts: t.Statement[] = residualStmts.map(
    (stmt) => tryHoistArrowToFunction(stmt) ?? stmt,
  );

  // Generate user statements as a single Babel program so we get one coherent
  // source map. The AST nodes already carry correct .rozie line numbers
  // (startLine was passed to @babel/parser in parseScript.ts), so the map
  // produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the
  // final map references the correct tsx output line numbers.
  let userArrowsSection = '';
  let scriptMap: EncodedSourceMap | null = null;

  if (filteredStmts.length > 0) {
    const sourceFileName = collectors.filename ?? '<rozie>';
    const genResult = generate(
      t.file(t.program(filteredStmts)),
      { ...GEN_OPTS_MAP, sourceFileName },
    );
    userArrowsSection = genResult.code;
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  const hookSection = hookLines.join('\n');
  const hookSectionLines = hookLines.length;

  return {
    hasPortals: portalsEmit.hasPortals,
    hookSection,
    userArrowsSection,
    userImports,
    hoistedTypeDecls,
    mergePropsCall,
    hookSectionLines,
    scriptMap,
    providerOpen: contextEmit.providerOpen,
    providerClose: contextEmit.providerClose,
    diagnostics,
  };
}

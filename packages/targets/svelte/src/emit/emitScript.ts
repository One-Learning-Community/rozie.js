/**
 * emitScript — Phase 5 Plan 02a Task 1.
 *
 * Produces the body of `<script lang="ts">` for a Svelte 5+ SFC. Output
 * order (per RESEARCH.md Pattern 1 + Plan §<action>):
 *
 *   1. import type { Snippet } from 'svelte';        (only if slots present)
 *   2. interface Props { ... }                       (only if props OR slots present)
 *   3. let { ... }: Props = $props();                (only if props OR slots present)
 *   4. let dataX = $state(initializer);              (per StateDecl)
 *   5. let refX = $state<HTMLElement>();             (per RefDecl — bare let, bind:this in template)
 *   6. residual <script> body (verbatim @babel/generator output)
 *   7. const computedX = $derived(expr);             (per ComputedDecl)
 *   8. $effect(() => { setup; return cleanup; });    (per LifecycleHook — D-19 paired)
 *   9. $effect listener blocks                       (appended by emitListeners — Task 3)
 *
 * Residual-before-derived/effect mirrors Vue: keeps user-authored helper
 * functions and `console.log` close to the top of the script and lets
 * `$derived`/`$effect` references resolve naturally because `const`
 * declarations from the residual body are in scope.
 *
 * Per RESEARCH Pitfall 7: array re-assignments (`items = [...items, x]`) are
 * preserved verbatim — Svelte's `$state` re-runs effects on re-assignment.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` imports —
 * debounce / throttle / outsideClick all inline in v1.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  ComputedDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { resolveComponentRefs } from '../../../../core/src/codegen/resolveComponentRefs.js';
import { isMutableLiteralFactoryDefault } from '../../../../core/src/codegen/propDefaultFactory.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers, svelteCallbackPropName } from '../rewrite/rewriteScript.js';
import { collectSvelteImports } from '../rewrite/collectSvelteImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { buildSlotTypeFields, distinctSlotsByName } from './refineSlotTypes.js';
import { emitPortals } from './emitPortals.js';
import { emitContext } from './emitContext.js';
import { portalSlotMergeName } from './portalSlotMergeName.js';
import { buildPropJsdoc } from '../../../../core/src/codegen/buildPropJsdoc.js';
import { computeTsCastWrapText, unwrapTsCast } from '../../../../core/src/ast/unwrapTsCast.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations (D-104/D-106) give
// those maps real positional content; non-annotated scaffolding falls back
// to nearest-segment via the surrounding shell map (D-102).
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
  sourceFileName: '<rozie>',
};

// Used only when emitting the residual (user-authored) statement block with
// source maps — a single t.Program generate call so we get one coherent map.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * Quick 260717-uvl — rewriteTemplateExpression's flattenInlineCode collapses
 * every newline to a single space WITHOUT stripping `//` line comments. A
 * multi-line `<data>` initializer (e.g. an object literal with an inline
 * `// comment` on one of its properties) would have that comment silently
 * swallow the REST of the flattened line — a real, observed corpus bug (the
 * FlowCanvas demo's `graph` initializer). Strip all comments from a cloned
 * copy of the initializer before routing it through the per-target rewriter,
 * scoped to ONLY this new call site (template/handler expressions elsewhere
 * are single-line already and keep their comments untouched).
 */
function stripInitializerComments<T extends t.Node>(node: T): T {
  const cloned = t.cloneNode(node, true, false);
  t.traverseFast(cloned, (n) => {
    delete n.leadingComments;
    delete n.trailingComments;
    delete n.innerComments;
  });
  return cloned;
}

/**
 * Quick 260717-uvl — true when a `<data>` initializer contains a `$props`/
 * `$data` member access anywhere in its subtree (the ONLY shapes that reach
 * emit — `$refs`/`$slots` in a `<data>` initializer remain a ROZ208 error and
 * never get this far). Gates the rewriteTemplateExpression routing so a
 * PLAIN initializer (the overwhelming majority — no sigil at all) keeps its
 * ORIGINAL genCode() output byte-identical (multi-line pretty-printed,
 * comments intact). Only a sigil-bearing initializer pays the
 * flattened-single-line cost rewriteTemplateExpression's shared
 * flattenInlineCode imposes — scoping this quick task's snapshot diff to
 * exactly the initializers it is meant to fix.
 */
function initializerHasLeakingSigil(node: t.Node): boolean {
  let found = false;
  t.traverseFast(node, (n) => {
    if (found) return;
    if (t.isMemberExpression(n) && t.isIdentifier(n.object)) {
      if (n.object.name === '$props' || n.object.name === '$data') found = true;
    }
  });
  return found;
}

/**
 * Phase 16 D-02 — Capitalize the first letter for `__default<Capitalized>`
 * factory-default cache name (e.g. prop `items` → `__defaultItems`).
 */
function capitalize(name: string): string {
  return name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);
}

/**
 * Phase 14.1 follow-up — does any element in the IR template carry a
 * `spreadBinding` attribute? The Plan 14-05 gates at three sites in this
 * module only synthesise the `...__rozieAttrs` destructure (and its
 * accompanying Props interface index signature + the no-props-block
 * short-circuit) when `inheritAttrs !== false`. That's correct for
 * auto-fallthrough, but wrong for the explicit-manual case:
 * `inherit-attrs="false"` plus author-written `r-bind="$attrs"` produces a
 * `spreadBinding` whose template emit references `__rozieAttrs` — but the
 * destructure that declares it is gated off, so the rendered component hits
 * "__rozieAttrs is not defined" at runtime and the Svelte tree collapses.
 *
 * Mirrors the Lit + React fixes: `inherit-attrs="false"` only opts out of
 * auto-fallthrough, not out of the author's right to reference `$attrs`
 * explicitly via `r-bind="$attrs"`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function templateUsesSpreadBinding(node: any): boolean {
  if (node === null || node === undefined) return false;
  if (node.type === 'TemplateElement') {
    for (const a of node.attributes ?? []) {
      if (a.kind === 'spreadBinding') return true;
    }
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateConditional' || node.type === 'TemplateMatch') {
    for (const branch of node.branches ?? []) {
      for (const c of branch.body ?? []) {
        if (templateUsesSpreadBinding(c)) return true;
      }
    }
    if (node.hostElement && templateUsesSpreadBinding(node.hostElement)) return true;
    return false;
  }
  if (node.type === 'TemplateLoop') {
    for (const c of node.body ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateFragment') {
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateSlotInvocation') {
    for (const c of node.fallback ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Extract the local `model: true` prop name a `twoWayBinding` writes, iff the
 * bound lvalue is a bare `$props.<name>` member expression. Returns the
 * property name (`$props.cards` → `'cards'`); returns `null` for `$data.*`
 * bindings or any other lvalue shape (those never re-expose a model prop).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function modelPropNameFromTwoWayExpr(expr: any): string | null {
  if (
    t.isMemberExpression(expr) &&
    !expr.computed &&
    t.isIdentifier(expr.object) &&
    expr.object.name === '$props' &&
    t.isIdentifier(expr.property)
  ) {
    return expr.property.name;
  }
  return null;
}

/**
 * Collect the names of this component's `model: true` props that are the WRITE
 * TARGET of a child two-way binding (`<Child r-model:x="$props.<model>"/>`) —
 * the "re-exposed model" shape (KanbanColumn `cards`, WrapperModal `open`).
 *
 * These are the ONLY model props that need a synthesized `on<key>change`
 * callback prop: Svelte's plain `bind:` propagates the child's writeback to the
 * component's `$bindable` prop but fires NO change EVENT, so a parent consuming
 * the model ONE-WAY (`:x` + `@x-change`, the deep-chain-lvalue fallback forced
 * by ROZ951) would never receive the writeback. `emitSingleAttr` emits the
 * Svelte 5.9 get/set function-binding form for these bindings so the setter
 * ALSO fires `on<key>change`, matching React (`onValueChange`) / Vue
 * (`defineModel`). Scoped to child-bound models so non-re-exposed model
 * components (e.g. SortableList's `items`, written in script + consumed via
 * `bind:`) stay byte-identical.
 */
function collectChildBoundModelNames(ir: IRComponent): Set<string> {
  const modelNames = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const out = new Set<string>();
  if (modelNames.size === 0) return out;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any): void => {
    if (node === null || node === undefined) return;
    if (node.type === 'TemplateElement') {
      for (const a of node.attributes ?? []) {
        if (a.kind === 'twoWayBinding' && a.expression) {
          const name = modelPropNameFromTwoWayExpr(a.expression);
          if (name !== null && modelNames.has(name)) out.add(name);
        }
      }
      for (const c of node.children ?? []) walk(c);
      for (const sf of node.slotFillers ?? []) {
        for (const c of sf.children ?? sf.body ?? []) walk(c);
      }
      return;
    }
    if (node.type === 'TemplateConditional' || node.type === 'TemplateMatch') {
      for (const branch of node.branches ?? []) {
        for (const c of branch.body ?? []) walk(c);
      }
      if (node.hostElement) walk(node.hostElement);
      return;
    }
    if (node.type === 'TemplateLoop') {
      for (const c of node.body ?? []) walk(c);
      return;
    }
    if (node.type === 'TemplateFragment') {
      for (const c of node.children ?? []) walk(c);
      return;
    }
    if (node.type === 'TemplateSlotInvocation') {
      for (const c of node.fallback ?? []) walk(c);
      return;
    }
  };
  walk(ir.template);
  return out;
}

/**
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Building the arrow as a Babel node (rather than string-templating
 * `() => ${genCode(body)}`) lets @babel/generator auto-wrap ObjectExpression
 * bodies in parens, so `$computed(() => ({ x: 1 }))` emits `() => ({ x: 1 })`
 * instead of `() => { x: 1 }` (a BlockStatement with LabeledStatement
 * `x: 1`).
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

/**
 * Phase 55-04 (literal byte-identity) — reproduce the inline-authored comment
 * doubling at a script-partial splice boundary.
 *
 * In an inline-authored `<script>`, a comment block BETWEEN two statements is
 * attached by `@babel/parser` to BOTH neighbours (the earlier statement's
 * `trailingComments` AND the later statement's `leadingComments`). The `.rzts`
 * script-partial splice attaches the boundary banner ONLY to the spliced node's
 * `leadingComments` — the preceding statement lives in a different source file and
 * carries no matching trailing comment. Svelte emits the residual body one
 * statement at a time (`stmts.map((s) => genCode(s)).join('\n')`), so each
 * `genCode` call has its own comment-dedup set: in the inline form the boundary
 * banner therefore prints TWICE (once as the previous statement's trailing, once
 * as the next statement's leading), with a blank line after the previous closing
 * brace. Re-mirroring the spliced node's leading comments back onto the preceding
 * statement's trailing comments restores that byte-for-byte.
 *
 * Fires at a genuine splice boundary in EITHER direction (Phase 56 R1 broadened
 * the trigger): the CURRENT statement is spliced (`cur.extra.__roziePartialOrigin`
 * — the Phase 55 leading seam) OR the PREVIOUS statement is spliced and CUR is an
 * inline host successor carrying the leading comment (the R1 TRAILING seam). In
 * both cases CUR's leading comments are mirrored onto PREV's trailing comments
 * UNLESS already shared (within-partial statement pairs share the same comment
 * objects; host-only pairs — neither node spliced — are left exactly as authored).
 * `normalizeSplicedEmitLines` (core) has already anchored the seam spacing, so the
 * mirrored trailing copy spaces correctly.
 */
/**
 * Quick task 260714-orv — compare two Babel comment nodes by SOURCE POSITION
 * (type + starting line/column) rather than object reference. A comment
 * shared between two adjacent statements' trailing/leading arrays sometimes
 * IS the exact same object, but an earlier pipeline pass (hoistModuleLet /
 * rewriteRozieIdentifiers / etc.) may clone an individual statement, minting
 * a content-identical comment object at a different reference. Two distinct,
 * independently-authored comments can never share a starting source
 * position, so this is a safe substitute for `===` this late in the
 * pipeline.
 */
function isSameSourceComment(a: t.Comment, b: t.Comment): boolean {
  if (a === b) return true;
  if (!a.loc || !b.loc) return false;
  return (
    a.type === b.type &&
    a.loc.start.line === b.loc.start.line &&
    a.loc.start.column === b.loc.start.column
  );
}

function mirrorSpliceBoundaryComments(stmts: t.Statement[]): void {
  for (let i = 1; i < stmts.length; i++) {
    const cur = stmts[i]!;
    const prev = stmts[i - 1]!;
    const curExtra = cur.extra as Record<string, unknown> | undefined;
    const prevExtra = prev.extra as Record<string, unknown> | undefined;
    const curSpliced = curExtra?.__roziePartialOrigin !== undefined;
    const prevSpliced = prevExtra?.__roziePartialOrigin !== undefined;
    // Fire ONLY at a genuine splice boundary, in EITHER direction. Host-only pairs
    // (neither node spliced) are left exactly as authored — EXCEPT for the
    // de-dup below (quick task 260714-orv).
    if (!curSpliced && !prevSpliced) {
      // Quick task 260714-orv — @babel/parser attaches a HOST-authored comment
      // block sitting BETWEEN two adjacent statements to BOTH neighbours (the
      // earlier statement's trailingComments AND the later statement's
      // leadingComments cover the SAME source comment run — sometimes even the
      // exact same array object, but earlier rewrite passes in this pipeline
      // (hoistModuleLet / rewriteRozieIdentifiers / etc.) may individually
      // clone a statement, producing content-identical comment objects that no
      // longer share a reference. Compare by SOURCE POSITION (`isSameSourceComment`)
      // rather than `===` so the de-dup survives that cloning. Strip any
      // trailing comment of PREV that source-matches a leading comment of CUR
      // — CUR's leading side still prints each one once. Gated STRICTLY to
      // this host-only pair (no splice involved) so splice-boundary pairs
      // (handled below) and independently-authored adjacent comments (no
      // source-position match) are untouched.
      const prevTrail = prev.trailingComments;
      const curLead = cur.leadingComments;
      if (prevTrail && prevTrail.length > 0 && curLead && curLead.length > 0) {
        const deduped = prevTrail.filter(
          (c) => !curLead.some((lc) => isSameSourceComment(c, lc)),
        );
        prev.trailingComments = deduped.length > 0 ? deduped : null;
      }
      continue;
    }
    const lead = cur.leadingComments;
    const prevTrail = prev.trailingComments;
    // AFTER-side seam (Phase 56 shape-5): CUR is the spliced node with NO leading
    // comment of its own, but PREV (a HOST node) carries a trailing boundary comment.
    // Inline, that comment is ONE @babel object shared as prev.trailing + cur.leading,
    // so per-statement generation prints it TWICE; the splice severed the shared
    // object, leaving it only on prev.trailing → ONE copy. Mirror prev.trailing onto
    // CUR's (empty) leadingComments to restore the inline doubling. Gated to
    // prev-NOT-spliced so the mirrored comment is a HOST-authored boundary comment
    // (within-partial pairs already share their objects and are handled below). A
    // LEADING CommentLine renders own-line with no same-line collision (unlike the
    // TRAILING-seam clone below), so the shared comment objects can be reused as-is.
    if (curSpliced && !prevSpliced && (!lead || lead.length === 0) && prevTrail && prevTrail.length > 0) {
      cur.leadingComments = [...prevTrail];
      continue;
    }
    // The remaining (LEADING / TRAILING) seams require CUR to carry the boundary
    // comment; with none there is nothing further to mirror.
    if (!lead || lead.length === 0) continue;
    // Phase 56-R10 (STRIPPED-PREDECESSOR LEADING seam): CUR is the spliced node and its run's
    // first emit token is a LEADING comment whose IMMEDIATE source predecessor is a sigil
    // DIRECTIVE that the residual emit STRIPS (`normalizeSplicedEmitLines` stamps
    // `cur.extra.__rozieLeadingSeamPrevStripped` — the real DataTable `exposeStateVerbs` run
    // sits directly below `$provide('data-table:columns', …)`). Inline, @babel shares the
    // boundary comment as the predecessor's trailing + the spliced decl's leading, but the
    // predecessor's trailing copy is dropped WITH the stripped statement → the comment
    // SINGLE-emits. The splice severs the shared object, so the LEADING-seam mirror below would
    // re-create the prev-trailing copy and DOUBLE it. Skip the mirror for this seam to match the
    // inline oracle. Gated to curSpliced (the leading seam) so the R1 TRAILING seam (prevSpliced)
    // and the after-side branch are untouched; a SURVIVING predecessor (plain `let`/`const`,
    // e.g. `let expandedTouched` above `groupingActiveDefault`) leaves the seam UNSTAMPED → the
    // mirror still doubles, matching ITS inline oracle (data-table baseline + HostK unchanged).
    if (curSpliced && (curExtra as { __rozieLeadingSeamPrevStripped?: boolean } | undefined)?.__rozieLeadingSeamPrevStripped === true) continue;
    const lastLead = lead[lead.length - 1];
    // Identity guard (Pitfall 2 / A4): a node can be simultaneously the spliced
    // successor of one seam and the spliced predecessor of the next. If the comment
    // is already shared as prev's trailing (within-partial pairs share the same
    // objects), leave it — never double-apply.
    if (prevTrail && prevTrail.length > 0 && prevTrail[prevTrail.length - 1] === lastLead) {
      continue;
    }
    let toAppend = lead;
    if (prevSpliced && !curSpliced) {
      // R1 TRAILING seam: CUR is an inline HOST successor whose leading comments
      // carry HOST `loc`s that can collide with the SPLICED predecessor's shifted
      // `loc`, making @babel/generator print a `CommentLine` trailing comment on the
      // SAME line as PREV (`const x = …; // c`). The inline oracle prints both copies
      // on their OWN lines. Clone the comments with a `loc` one line past PREV so the
      // trailing copy renders own-line, reproducing the oracle byte-for-byte. Cloning
      // leaves CUR's leadingComments (the shared host objects) untouched.
      //
      // Phase 56-R8 (gap-1 after-side seam): when CUR sits ONE-OR-MORE intended blank
      // lines below the spliced run in the host source, `normalizeSplicedEmitLines`
      // stamps `cur.extra.__rozieAfterGap` (the reproduced gap; gap 2 = one blank).
      // Anchor the cloned trailing copy `afterGap` lines past PREV so the boundary blank
      // is reproduced (a gap-0 trailing seam carries no marker → +1, byte-identical).
      const afterGap = (curExtra as { __rozieAfterGap?: number } | undefined)?.__rozieAfterGap;
      const anchorLine =
        (prev.loc?.end.line ?? 0) + (typeof afterGap === 'number' ? afterGap : 1);
      // Phase 56-R11 (after-side INTER-COMMENT-BLOCK seam): when CUR (the host successor)
      // carries MORE THAN ONE leading comment block — `[comment A][blank][comment B]` (the
      // real 56-09 Wave-9 P9 `gridKeydownHandlers` / P12 `fillDrag` after-sides, two
      // consecutive host comment-blocks downstream of the spliced run) — anchoring EVERY
      // cloned comment on the SAME `anchorLine` collapses the blank BETWEEN the blocks (and
      // any multi-line block's own height). The first blank (spliced tail → block A) is the
      // `afterGap` reproduced by `anchorLine`; the SECOND blank (block A → block B) lives in
      // the source line delta between the comments. Preserve each comment's delta from the
      // FIRST comment's start line so the inter-comment-block blank renders, anchoring block A
      // at `anchorLine` and block B (and its own lines) `delta` lines past it. For a SINGLE
      // comment (HostJ/HostE/HostI) every delta is 0 → byte-identical to the prior flatten.
      // react/angular/solid/lit are unaffected (they reconstruct/strip/whole-program-dedup the
      // comment, reading the core loc deltas directly — solid already preserves both blanks).
      const baseLine = lead[0]?.loc?.start.line;
      toAppend = lead.map((c) => {
        if (!c.loc) return { ...c };
        const startLine =
          baseLine === undefined ? anchorLine : anchorLine + (c.loc.start.line - baseLine);
        const endLine =
          baseLine === undefined ? anchorLine : anchorLine + (c.loc.end.line - baseLine);
        return {
          ...c,
          loc: {
            ...c.loc,
            start: { ...c.loc.start, line: startLine },
            end: { ...c.loc.end, line: endLine },
          },
        };
      });
    }
    prev.trailingComments = [...(prevTrail ?? []), ...toAppend];
  }
}

/**
 * SvelteScriptInjection — opaque token type that Tasks 2/3 append to. Mirrors
 * Vue's ScriptInjection — emitTemplate (Task 2) may add inline-debounce IIFEs
 * for template @event modifiers, emitListeners (Task 3) may add throttle
 * wrapper IIFEs. Plan 02a v1 emits ZERO injections from emitScript itself.
 *
 * Each injection has:
 *   - `decl`: a script-level `const X = (() => { ... })();` style declaration
 *   - `position`: where to splice it ('top' = before residual body, 'bottom' =
 *      after residual body, used for handlers that reference user-declared
 *      consts which would TDZ if hoisted)
 */
export interface SvelteScriptInjection {
  /** Stable name for the injected helper (used by callers to reference it). */
  name: string;
  /** Full declaration text (including trailing semicolon). */
  decl: string;
  /** Splice position relative to the residual <script> body. */
  position: 'top' | 'bottom';
}

/**
 * Render a PropTypeAnnotation as a TypeScript type string. Mirrors the Vue
 * target's renderType helper.
 */
function renderType(type: PropTypeAnnotation): string {
  if (type.kind === 'identifier') {
    switch (type.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      // Array/Object widen to `any[]` / `any` so user-authored params on
      // items / nodes don't surface as `'x' is of type 'unknown'` under
      // svelte-check. v1 IR doesn't carry element / property shape so we
      // can't narrow further; consumers can still annotate explicitly in
      // .rozie when they care (TYPES-01 / Phase 6 refines).
      case 'Array':
        return 'any[]';
      case 'Object':
        return 'any';
      case 'Function':
        return '(...args: any[]) => any';
      default:
        return type.name;
    }
  }
  if (type.kind === 'union') {
    // A function-type member MUST be parenthesized inside a union — `string | (...) => x`
    // is ambiguous/invalid TS (the arrow binds the whole union); `string | ((...) => x)` is
    // correct. Only function members need wrapping.
    return type.members
      .map((m) => {
        const r = renderType(m);
        const isFn =
          (m.kind === 'identifier' && m.name === 'Function') ||
          (m.kind === 'literal' && m.value === 'function');
        return isFn ? `(${r})` : r;
      })
      .join(' | ');
  }
  if (type.kind === 'literal') {
    if (type.value === 'array') return 'any[]';
    if (type.value === 'object') return 'any';
    if (type.value === 'function') return '(...args: any[]) => any';
    return type.value;
  }
  return 'unknown';
}

/**
 * Build the `interface Props { ... }` body fields. Returns a list of indented
 * lines suitable for splicing inside `interface Props {\n${...}\n}`.
 *
 * Includes BOTH props and slots (per RESEARCH Pattern 1 + Pattern 3 — slots
 * are properties of the same Props type).
 */
function buildPropsInterfaceFields(ir: IRComponent): string[] {
  const lines: string[] = [];

  for (const p of ir.props) {
    let typeText = renderType(p.typeAnnotation);
    // When the declared default is `null`, broaden the type with `| null` so
    // the destructure `name = null` doesn't trip svelte-check (which sees
    // `Type 'null' is not assignable to type '...'`). Common case is
    // `Function`-typed props with `default: null` (CardHeader.onClose).
    // Parens are mandatory — without them `(...args: any[]) => any | null`
    // parses as `(...args: any[]) => (any | null)` (return-type union), not
    // a union of the function type with null.
    if (p.defaultValue !== null && t.isNullLiteral(p.defaultValue)) {
      typeText = `(${typeText}) | null`;
    }
    // 260521-oao — `p.required` is the SOLE optionality determinant: a
    // `required: true` prop drops the `?` and emits a non-optional field.
    // The destructure entry already emits a bare `name` (non-model) /
    // `$bindable()` (model) for no-default props, so no destructure change
    // is needed — the interface `?:` removal is the load-bearing change.
    const opt = p.required ? '' : '?';
    // Phase 58 (SC-2/SC-3) — leading per-prop JSDoc from the shared builder,
    // gated on `p.docs` (returns '' for a docless prop → byte-identical, SC-5).
    const jsdoc = buildPropJsdoc(p, '  ');
    if (jsdoc) lines.push(jsdoc.replace(/\n$/, ''));
    lines.push(`  ${p.name}${opt}: ${typeText};`);
  }

  // Slot fields share the Props interface — Snippet<[...]> typed.
  const slotLines = buildSlotTypeFields(ir.slots);
  for (const sl of slotLines) lines.push(sl);

  // Phase 07.3.1 D-SV-16 — accept consumer-side dynamic-name snippets map;
  // merged into named props via $derived in script body. The consumer-side
  // emitter (emitSlotFiller.ts:174) emits `snippets={{ [expr]: __rozieDynSlot_N }}`
  // for `<template #[dynamic]>` fills; without this prop the producer destructure
  // silently drops the dynamic projection.
  //
  // Typed as `Record<string, any>` (not `Record<string, Snippet<[any]>>`) so the
  // `const X = $derived(__XProp ?? snippets?.X)` merge below preserves the
  // per-slot Snippet signature from `__XProp`. A more specific Snippet<...>
  // would force the union into the more-strict shape and surface as
  // "Expected 1 arguments, but got 0" at every `{@render X?.()}` callsite for
  // zero-param slots (Card.children, TodoList.empty). Dynamic-name snippets
  // are inherently untyped — the fill expression is computed at runtime.
  if (ir.slots.length > 0) {
    lines.push('  snippets?: Record<string, any>;');
  }

  // Emit callback-prop declarations: $emit('search', x) was rewritten to
  // onsearch?.(x) by rewriteScript; the corresponding `onsearch?` prop must
  // be declared and destructured. Svelte 5 callback-prop convention is
  // ALL-LOWERCASE (e.g., `onclose`, `onsearch`) — NOT React's PascalCase
  // `onSearch`. v1 types args as `(...args: unknown[]) => void` since IR
  // doesn't carry per-emit arg types (Phase 6 TYPES-01 refines).
  //
  // Phase 07.7 fix — shared `svelteCallbackPropName` helper strips hyphens
  // from emit names before lowercasing. Without the strip, an emit like
  // `event-click` produced `onevent-click` (literal hyphen in identifier
  // position) — invalid TS syntax. Both this emit and rewriteScript's
  // $emit-lowering use the same helper to stay in lockstep.
  for (const e of ir.emits) {
    const onName = svelteCallbackPropName(e);
    lines.push(`  ${onName}?: (...args: unknown[]) => void;`);
  }

  // Synthesized `on<key>change` callback for each re-exposed model prop (a
  // model written by a child `bind:` — KanbanColumn `cards`, WrapperModal
  // `open`). Svelte models carry no change EVENT on their own; this restores
  // React/Vue parity for parents consuming the model ONE-WAY (`:x` + `@x-change`).
  // The write is fired from the get/set binding emitted by `emitSingleAttr`.
  for (const name of collectChildBoundModelNames(ir)) {
    const onName = svelteCallbackPropName(`${name}-change`);
    lines.push(`  ${onName}?: (...args: unknown[]) => void;`);
  }

  // Plan 14-05 — when `inheritAttrs !== false`, declare an index signature so
  // the synthesised `...__rozieAttrs` rest destructure types as
  // `Record<string, unknown>`. The signature is permissive (`unknown` not
  // `any`) — consumer-facing typing stays strict for ALL declared props
  // above; only the rest bucket accepts arbitrary keys (mirrors Vue's
  // `$attrs: Record<string, unknown>` magic accessor / React's
  // `Omit<HTMLAttributes, …>` spread idiom).
  //
  // Phase 14.1 follow-up — the explicit-manual case (`inherit-attrs="false"`
  // + author-written `r-bind="$attrs"`) ALSO destructures `...__rozieAttrs`
  // via the gate-widen at `buildPropsDestructureEntries`; that destructure
  // needs a matching `Record<string,unknown>` slot on the Props interface or
  // svelte-check fails the rest pattern.
  if (ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template)) {
    lines.push('  [key: string]: unknown;');
  }

  return lines;
}

/**
 * Render the destructuring entries inside `let { ... }: Props = $props();`.
 *
 * Each prop becomes `name = defaultValue` or `name = $bindable(defaultValue)`
 * for `model: true`. Slot props (children + named) appear as bare names —
 * Svelte assigns the snippet to the destructured local; no default value.
 *
 * Per Pitfall 11: `$bindable()` props need an explicit `$bindable(...)` rune;
 * snippet props are immutable (we never emit reassignment to them).
 */
function buildPropsDestructureEntries(ir: IRComponent): string[] {
  const entries: string[] = [];

  for (const p of ir.props) {
    const dflt = p.defaultValue !== null ? genCode(p.defaultValue) : null;
    if (p.isModel) {
      // model: true → $bindable(default) wrapper. With NO default → $bindable().
      //
      // D-VR-04: `$bindable(x)` takes a *fallback value*, not a factory — so a
      // Rozie `default: () => []` factory must be INVOKED here, not passed
      // through verbatim. Passing the arrow through made `items` resolve to the
      // function itself, so `items.filter(...)` threw "filter is not a
      // function" on a bare-mounted Svelte component. Mirror the React target,
      // which emits the invoked `(() => [])()` form. A non-function default
      // (literal / identifier) is passed straight through.
      // Spike-012 — invoke ONLY an array/object-literal-body factory arrow; a
      // `type: Function, default: () => {}` arrow is the noop-function VALUE, not
      // a factory (matching Vue/Angular/Lit) — passed through un-invoked.
      let inner = dflt !== null ? dflt : '';
      if (isMutableLiteralFactoryDefault(p.defaultValue)) {
        inner = `(${dflt})()`;
      }
      entries.push(`${p.name} = $bindable(${inner})`);
    } else if (dflt !== null) {
      // Phase 16 D-02 — for factory defaults (() => [], () => ({...})), use the
      // module-init cached value `__default<Capitalized>` rather than re-
      // invoking the factory at every props re-read. The cache prelude lines
      // are emitted by `buildPropsFactoryDefaultPrelude` and inserted before
      // the destructure in `emitPropsBlock`. This is the once-per-instance
      // contract (mirrors Vue 3's withDefaults factory-default semantics).
      //
      // Without this change the destructure `let { e = (() => [])() } = $props()`
      // re-runs the factory on every render, breaking `props.e === props.e`
      // reference-equality across renders — the SortableList canary surface
      // for SPEC R1 D-02.
      //
      // Literal/identifier/null/primitive defaults pass through verbatim.
      const isFactory = isMutableLiteralFactoryDefault(p.defaultValue);
      const value = isFactory ? `__default${capitalize(p.name)}` : dflt;
      entries.push(`${p.name} = ${value}`);
    } else {
      // No default — bare destructure (Svelte will leave undefined).
      entries.push(p.name);
    }
  }

  // Slot prop destructures.
  //
  // Phase 07.3.1 D-SV-16 — when slots are present, rename each destructured
  // slot prop to a temp (`header: __headerProp`) so the script body can
  // declare a `$derived` merge (`const header = $derived(__headerProp ?? snippets?.header)`)
  // that prefers the statically-named consumer fill but falls back to the
  // dynamic-name `snippets` map entry. Also destructures `snippets` itself.
  // When `ir.slots.length === 0` we keep the legacy no-snippets shape — no
  // rename and no `snippets` entry, so non-slotted components are unaffected.
  if (ir.slots.length > 0) {
    // Dedupe by distinct slot name — a repeated `<slot name="X">` must produce
    // exactly ONE `X: __XProp` destructure binding (see distinctSlotsByName).
    for (const s of distinctSlotsByName(ir.slots)) {
      const key = s.name === '' ? 'children' : s.name;
      entries.push(`${key}: __${key}Prop`);
    }
    entries.push('snippets');
  } else {
    // Default-slot sentinel still maps to `children`; bare names per Svelte
    // magic-prop convention. (Loop body is unreachable when slots.length === 0
    // but kept for clarity / future-proofing.)
    for (const s of distinctSlotsByName(ir.slots)) {
      const key = s.name === '' ? 'children' : s.name;
      entries.push(key);
    }
  }

  // Emits → bare destructure of the normalized callback prop. Matches
  // the rewriteScript output (`onsearch?.(x)` / `oneventclick?.(x)`).
  // Phase 07.7 fix — shared svelteCallbackPropName helper strips hyphens.
  for (const e of ir.emits) {
    entries.push(svelteCallbackPropName(e));
  }

  // Re-exposed model props → destructure the synthesized `on<key>change`
  // callback out of `...__rozieAttrs` so the get/set binding's setter (emitted
  // by emitSingleAttr) can invoke it. Without this the handler would fall into
  // the rest bucket and be attached as a dead native `addEventListener`.
  for (const name of collectChildBoundModelNames(ir)) {
    entries.push(svelteCallbackPropName(`${name}-change`));
  }

  // Plan 14-05 — cross-framework attribute fallthrough rest binding. When
  // `inheritAttrs !== false`, synthesise `...__rozieAttrs` so the
  // template-root `{...$attrs}` spread (synthesised by `synthesizeAttrsFallthrough`
  // in lower.ts AND any author-written `r-bind="$attrs"`) has a runes-mode-
  // compatible target. Svelte 5 runes-mode rejects the legacy `$$restProps`
  // identifier (`Cannot use \`$$restProps\` in runes mode`), so the rewrite
  // in `rewriteTemplateExpression.ts` lowers `$attrs` → `__rozieAttrs` and
  // this entry binds the rest. When `inheritAttrs === false`, no entry is
  // added (and the synthesis pass skips the spread injection per R5).
  //
  // Phase 14.1 follow-up — also synthesise when the template carries an
  // explicit `spreadBinding` (`r-bind="$attrs"`). Without this, the
  // template emit references `__rozieAttrs` (via the `$attrs` → `__rozieAttrs`
  // rewrite) while the destructure that declares it is gated off, so the
  // component crashes with "__rozieAttrs is not defined" at runtime.
  if (ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template)) {
    entries.push('...__rozieAttrs');
  }

  return entries;
}

/**
 * Phase 07.3.1 D-SV-16 — Emit one `$derived` line per slot that merges the
 * statically-named consumer fill (via `__<key>Prop`) with the dynamic-name
 * fill (via `snippets?.<key>`).
 *
 * Precedence rule (`__<key>Prop ?? snippets?.<key>`): the statically-named
 * consumer fill wins when both are present. This matches user intent —
 * `<template #header=...>` is the more specific binding compared with
 * `<template #[dynamicName]>` where `dynamicName === 'header'`.
 *
 * Returns `[]` when `ir.slots.length === 0` so the helper is a no-op for
 * non-slotted components (preserving byte-identical output for Counter etc.).
 */
function emitSlotDerivedMerges(ir: IRComponent): string[] {
  if (ir.slots.length === 0) return [];
  const lines: string[] = [];
  // Dedupe by distinct slot name — a repeated `<slot name="X">` must produce
  // exactly ONE `$derived` merge declaration (see distinctSlotsByName).
  //
  // `portalSlotMergeName` is the SINGLE source of truth for the merge
  // identifier (Phase 73 item #1 folded the r-for-loop-var / script-param-scope
  // / reprojection collision checks into it — see its docstring): a `X$$slot`
  // suffix when a `<slot name="X">` is rendered inside an `r-for` whose loop
  // var is also `X` (runtime crash — Svelte shadows the snippet binding with
  // the loop item), OR a top-level `<script>` helper's PARAMETER is named `X`
  // (script-side `$slots.X` reads would otherwise resolve to the shadowed
  // param), OR `X` is re-projected into a child component's same-named slot; a
  // `XSlot` suffix when `X` collides with a declared `<data>`/`$computed`/
  // top-level-helper NAME (duplicate-declaration compile error, not a runtime
  // shadow); else the bare name. Lockstep with the SAME helper used by
  // emitPortals.ts / rewriteScript.ts / rewriteTemplateExpression.ts and the
  // emitSlotInvocation.ts render site. Non-colliding slots stay byte-identical.
  for (const s of distinctSlotsByName(ir.slots)) {
    const key = s.name === '' ? 'children' : s.name;
    const ident = portalSlotMergeName(key, ir);
    lines.push(`const ${ident} = $derived(__${key}Prop ?? snippets?.${key});`);
  }
  return lines;
}

/**
 * Phase 16 D-02 — Build module-init factory-default cache prelude lines.
 *
 * For each non-model prop whose `default:` is an arrow / function expression,
 * emit `let __default<Capitalized> = (<factory>)();` so the destructure can
 * reference the cached value rather than re-invoking the factory on every
 * props re-read. This is the once-per-instance contract — `props.e ===
 * props.e` across consecutive renders (matches Vue 3's withDefaults
 * factory-default semantics).
 *
 * Empty array when no factory-default props are present.
 */
function buildPropsFactoryDefaultPrelude(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const p of ir.props) {
    if (p.isModel) continue;
    if (p.defaultValue === null) continue;
    // Only array/object-literal-body factory arrows are cached + invoked; a
    // `type: Function` value default (`() => {}`) is not a factory (Spike-012).
    if (!isMutableLiteralFactoryDefault(p.defaultValue)) continue;
    const raw = genCode(p.defaultValue);
    lines.push(`let __default${capitalize(p.name)} = (${raw})();`);
  }
  return lines;
}

/**
 * Emit the Props interface + destructure block. Returns an empty string when
 * there are no props AND no slots.
 */
function emitPropsBlock(ir: IRComponent): string {
  // Plan 14-05 — even when no props/slots/emits, an `inheritAttrs !== false`
  // component needs the `...__rozieAttrs` rest binding so the synthesised
  // template-root `{...$attrs}` spread (lower.ts `synthesizeAttrsFallthrough`)
  // resolves. The condition below therefore considers attr-fallthrough as a
  // gating signal alongside the legacy props/slots/emits trio.
  //
  // Phase 14.1 follow-up — also widen the gate to the explicit-manual case
  // (`inherit-attrs="false"` + `r-bind="$attrs"`), which carries a
  // `spreadBinding` in the IR template.
  const hasAttrsFallthrough =
    ir.inheritAttrs !== false || templateUsesSpreadBinding(ir.template);
  if (
    ir.props.length === 0 &&
    ir.slots.length === 0 &&
    ir.emits.length === 0 &&
    !hasAttrsFallthrough
  ) {
    return '';
  }

  const fields = buildPropsInterfaceFields(ir);
  const entries = buildPropsDestructureEntries(ir);
  // Phase 07.3.1 D-SV-16 — per-slot merge lines spliced after the destructure.
  const mergeLines = emitSlotDerivedMerges(ir);
  // Phase 16 D-02 — factory-default cache prelude (`let __defaultX =
  // (<factory>)();` per factory-default prop). Emitted BEFORE the destructure
  // so the destructure can reference the cached name.
  const factoryDefaultPrelude = buildPropsFactoryDefaultPrelude(ir);

  const interfaceBlock = `interface Props {\n${fields.join('\n')}\n}`;

  // Multi-line destructure for readability when more than 2 entries.
  // Plan 14-05 — when the last entry is the `...__rozieAttrs` rest pattern,
  // the trailing-comma form `..., \n}` is a JS parse error
  // ("Comma is not permitted after the rest element"). Use a no-trailing-comma
  // form for the multi-line variant; the rest entry is ALWAYS last when it
  // exists (appended after props/slots/emits in buildPropsDestructureEntries).
  let destructure: string;
  if (entries.length <= 2) {
    destructure = `let { ${entries.join(', ')} }: Props = $props();`;
  } else {
    destructure = `let {\n  ${entries.join(',\n  ')}\n}: Props = $props();`;
  }

  const preludeBlock =
    factoryDefaultPrelude.length > 0
      ? `${factoryDefaultPrelude.join('\n')}\n\n`
      : '';
  const mergeBlock = mergeLines.length > 0 ? `\n\n${mergeLines.join('\n')}` : '';
  return `${interfaceBlock}\n\n${preludeBlock}${destructure}${mergeBlock}`;
}

/**
 * Emit `let foo = $state(initializer);` per StateDecl.
 */
function emitStateDecls(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const s of ir.state) {
    // Quick task 260520-w18 bug class 2 — an empty-array `<data>` initializer
    // (`files: []`) types as `let files = $state([])` → `never[]`, so
    // `files.map(f => f.id)` fails TS2339 ("Property 'id' does not exist on
    // type 'never'"). Engine wrappers routinely seed a `$data` array empty
    // and let the engine populate it. Annotate the empty-array literal case
    // with an explicit `: any[]` type annotation on the `let` binding.
    //
    // Phase 16-04 — `<data>` `null` initializer types as `let x = $state(null)`
    // → `null`, so `x = <number>` fails TS2322. SortableList keyboard re-land
    // uses `liftedIndex: null` and assigns a number. Mirrors Angular's
    // `signal<any>(null)` widening (Plan 16-01) and React's `useState<any>(null)`
    // widening — annotate the bare-null case with `: any`.
    let typeAnnotation = '';
    if (t.isArrayExpression(s.initializer) && s.initializer.elements.length === 0) {
      typeAnnotation = ': any[]';
    } else if (t.isNullLiteral(s.initializer)) {
      typeAnnotation = ': any';
    }
    // Quick 260717-uvl (ROZ208 make-it-work) — route the initializer through
    // rewriteTemplateExpression (the SAME machinery already used to lower
    // `$props.X`/`$data.X` in templates/handlers) so a `<data>` initializer
    // that reads `$props.x`/`$data.x` (the idiomatic Vue-port derived-initial
    // pattern) lowers to the bare local read instead of leaking the raw sigil
    // (TS2304 + runtime ReferenceError). DESIGN CAVEAT: this SNAPSHOTS the
    // prop/data value at mount and does not track later changes (the
    // derived-state footgun, uniform across all six targets) — an `$onMount`
    // seed remains the honest REACTIVE form; this only makes the snapshot
    // form work.
    const initText = initializerHasLeakingSigil(s.initializer)
      ? rewriteTemplateExpression(stripInitializerComments(s.initializer), ir)
      : genCode(s.initializer);
    lines.push(`let ${s.name}${typeAnnotation} = $state(${initText});`);
  }
  return lines;
}

/**
 * Emit `let foo = $state<DomType>();` per RefDecl.
 *
 * Element-tag → DOM type guess; mirrors Vue's emitTemplateRefs helper.
 * In Svelte 5 refs are bare let bindings; the template's `bind:this={foo}`
 * directive populates them. They MUST be `$state(...)` to be reactive when
 * read inside `$derived` / `$effect` blocks.
 */
function emitRefDecls(ir: IRComponent): string[] {
  const lines: string[] = [];
  // Phase 66 (D-2 component-INSTANCE route, SC-2): a ref that points at a
  // `<components>`-composed CHILD types as the Svelte-5 component instance (the
  // exports carried by `bind:this`), so `$refs.child.exposedMethod()` typechecks.
  // The child is ALREADY imported by the Svelte shell's component-import
  // synthesis (emitSvelte.ts:234 `import Child from '...'`), so the component
  // name resolves in-scope — NO `<Name>Handle` import, NO `codegen.mjs` change.
  // The shared core resolver returns NOTHING for a DOM ref, so the DOM `switch`
  // below runs UNCHANGED for every non-composed ref (byte-identity carve-out).
  const componentRefs = resolveComponentRefs(ir);
  for (const r of ir.refs) {
    const componentLocalName = componentRefs.get(r.name);
    if (componentLocalName !== undefined) {
      // Svelte-5 `bind:this` on a component yields the instance whose surface
      // carries the `export const`-emitted `$expose` members. The component's
      // generated type is usable as the instance type via `ReturnType<typeof C>`
      // (svelte2tsx types the default export as a `Component<...>` factory whose
      // return is the instance exports).
      lines.push(
        `let ${r.name} = $state<ReturnType<typeof ${componentLocalName}> | undefined>(undefined);`,
      );
      continue;
    }
    let domType = 'HTMLElement';
    switch (r.elementTag.toLowerCase()) {
      case 'input':
        domType = 'HTMLInputElement';
        break;
      case 'textarea':
        domType = 'HTMLTextAreaElement';
        break;
      case 'select':
        domType = 'HTMLSelectElement';
        break;
      case 'button':
        domType = 'HTMLButtonElement';
        break;
      case 'form':
        domType = 'HTMLFormElement';
        break;
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
    lines.push(`let ${r.name} = $state<${domType} | undefined>(undefined);`);
  }
  return lines;
}

/**
 * Walk the cloned program and locate, for each ComputedDecl by name, the
 * corresponding initializer expression in the clone (post-rewrite).
 *
 * ROZ-cast-blindness fix — `d.init` unwraps through any TS wrapper (`as T` /
 * `!` / `satisfies T` / `<T>`) before the CallExpression check, so
 * `const label = $computed(() => ...) as string` is still recognized. The
 * cast text is captured per name (`casts`) so `emitDerivedDecls` can re-wrap
 * the emitted `$derived(...)` read in it.
 */
function findClonedComputedBodies(clonedProgram: t.File): {
  bodies: Map<string, t.Expression | t.BlockStatement>;
  casts: Map<string, { prefix: string; suffix: string }>;
} {
  const bodies = new Map<string, t.Expression | t.BlockStatement>();
  const casts = new Map<string, { prefix: string; suffix: string }>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init) continue;
      const call = unwrapTsCast(d.init);
      if (!t.isCallExpression(call)) continue;
      if (!t.isIdentifier(call.callee) || call.callee.name !== '$computed') continue;
      const cb = call.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        bodies.set(d.id.name, cb.body);
        casts.set(d.id.name, computeTsCastWrapText(d.init, genCode));
      }
    }
  }
  return { bodies, casts };
}

/**
 * Emit `const X = $derived(expr);` per ComputedDecl. Block-bodied computed
 * functions get `$derived.by(() => { ... })` per RESEARCH Pattern 1.
 *
 * ROZ-cast-blindness fix — re-apply the author's original TS wrapper (`as T`
 * / `!` / `satisfies T`) around the `$derived(...)`/`$derived.by(...)` read
 * so a cast-typed `$computed` keeps its author-declared type in the output.
 */
function emitDerivedDecls(
  computedDecls: ComputedDecl[],
  clonedComputedBodies: Map<string, t.Expression | t.BlockStatement>,
  clonedComputedCasts: Map<string, { prefix: string; suffix: string }>,
): string[] {
  const lines: string[] = [];
  for (const c of computedDecls) {
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    const cast = clonedComputedCasts.get(c.name);
    const prefix = cast?.prefix ?? '';
    const suffix = cast?.suffix ?? '';
    if (t.isBlockStatement(body)) {
      lines.push(`const ${c.name} = ${prefix}$derived.by(${arrowBody(body)})${suffix};`);
    } else {
      // Plain Expression body — pass directly to $derived(expr) so reactivity
      // tracks the read sites in `expr`. ObjectExpression bodies render as
      // `$derived({ x: 1 })` which is valid (and tracks any reactive reads
      // inside the object literal).
      lines.push(`const ${c.name} = ${prefix}$derived(${genCode(body)})${suffix};`);
    }
  }
  return lines;
}

/**
 * Quick plan 260515-u2b — emit `$effect(() => { (() => getter)(); (() => { cb; })(); })`
 * per top-level $watch call. Svelte 5's `$effect` auto-tracks any reactive
 * read inside its body; we IIFE-invoke the getter and the callback so:
 *   1. The getter's reads register the subscription on first run
 *   2. The callback fires both on first run AND on any subsequent re-trigger
 *      driven by getter signal changes
 *
 * Bug B fix (260519 linechart-watch-recreate) — the callback runs inside
 * `untrack(...)` so any reactive read that happens transitively (e.g. via a
 * helper `buildConfig()` that reads `$props.data`) is NOT pulled into the
 * watcher's dependency set. Only the getter defines what the watcher reacts
 * to — matching Vue's `watch(getter, cb)`, Solid's `on(getter, cb)`, and the
 * user's mental model. Without this, LineChart's `$watch($props.type)`
 * callback calls `buildConfig()` which reads `$props.data`; the data read
 * landed in the watcher's deps so it re-fired (and recreated the Chart.js
 * instance) on every data tick.
 *
 * Walks the cloned program; rewriteRozieIdentifiers already normalized
 * `$props.x` → `x` (post-destructure) and `$data.x` → bare-let-read.
 */
/**
 * 260602-9lw — detect a literal `{ immediate: true }` third argument on a cloned
 * `$watch(...)` call. Mirrors the core collector's parse discipline; any other
 * shape defaults to lazy. Re-read here because emitWatcherHooks walks the cloned
 * Program by source order rather than consuming `ir.watchers`.
 */
function watchCallIsImmediate(expr: t.CallExpression): boolean {
  const optionsArg = expr.arguments[2];
  if (!optionsArg || !t.isObjectExpression(optionsArg)) return false;
  for (const prop of optionsArg.properties) {
    if (!t.isObjectProperty(prop)) continue;
    if (prop.computed) continue;
    let key: string | null = null;
    if (t.isIdentifier(prop.key)) key = prop.key.name;
    else if (t.isStringLiteral(prop.key)) key = prop.key.value;
    if (key !== 'immediate') continue;
    if (t.isBooleanLiteral(prop.value) && prop.value.value === true) return true;
  }
  return false;
}

function emitWatcherHooks(
  clonedProgram: t.File,
): { lines: string[]; consumedIndices: Set<number>; needsUntrack: boolean } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  let needsUntrack = false;
  let watchIdx = 0;
  const body = clonedProgram.program.body;
  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    // ROZ-cast-blindness fix — unwrap through any TS wrapper before the
    // CallExpression check, so `$watch(...) as void` is still recognized.
    const expr = unwrapTsCast(stmt.expression);
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    if (expr.callee.name !== '$watch') continue;
    const getterArg = expr.arguments[0];
    const cbArg = expr.arguments[1];
    if (
      !getterArg ||
      (!t.isArrowFunctionExpression(getterArg) && !t.isFunctionExpression(getterArg))
    ) {
      continue;
    }
    if (
      !cbArg ||
      (!t.isArrowFunctionExpression(cbArg) && !t.isFunctionExpression(cbArg))
    ) {
      continue;
    }
    consumed.add(i);
    const getterCode = genCode(getterArg as t.Node);
    const cbCode = genCode(cbArg as t.Node);
    needsUntrack = true;
    const idx = watchIdx++;
    const immediate = watchCallIsImmediate(expr);
    // Wrap each in parens so the genCode emits a parenthesized arrow we can
    // immediately invoke as an IIFE inside the $effect block. Bind the
    // getter's evaluated value as the callback's first argument WHEN the
    // user-authored callback declares a parameter — otherwise svelte-check
    // flags "Expected 0 arguments, but got 1" for the `(() => {...})()` form.
    //
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). In Svelte 5 `$effect` fires
    // once at registration, so for the default (`!immediate`) we restore a
    // component-scope first-run gate (the `__rozieWatchInitial_N` flag that was
    // deleted in 260519). The getter still runs in tracking scope (subscribes);
    // the flag is read/written INSIDE `untrack(...)` so it does not subscribe
    // the effect to itself, and the callback is skipped on the first run.
    // `{ immediate: true }` keeps today's eager shape (callback fires at
    // registration).
    //
    // Bug B fix — the callback runs inside `untrack(...)` so transitive
    // reactive reads (a helper like `buildConfig()` reading `$props.data`) do
    // NOT subscribe the watcher. Only the getter defines the watcher's
    // dependency set — matching Vue/Solid/Angular/Lit.
    if (immediate) {
      if (cbParamCount(cbArg) > 0) {
        lines.push(
          `$effect(() => { const __watchVal = (${getterCode})(); untrack(() => (${cbCode})(__watchVal)); });`,
        );
      } else {
        lines.push(
          `$effect(() => { (${getterCode})(); untrack(() => (${cbCode})()); });`,
        );
      }
    } else {
      const flag = `__rozieWatchInitial_${idx}`;
      lines.push(`let ${flag} = true;`);
      if (cbParamCount(cbArg) > 0) {
        lines.push(
          `$effect(() => { const __watchVal = (${getterCode})(); untrack(() => { if (${flag}) { ${flag} = false; return; } (${cbCode})(__watchVal); }); });`,
        );
      } else {
        lines.push(
          `$effect(() => { (${getterCode})(); untrack(() => { if (${flag}) { ${flag} = false; return; } (${cbCode})(); }); });`,
        );
      }
    }
  }
  return { lines, consumedIndices: consumed, needsUntrack };
}

function cbParamCount(
  cbArg: t.ArrowFunctionExpression | t.FunctionExpression,
): number {
  return cbArg.params.length;
}

/**
 * Walk lifecycle hooks (D-19 paired) and emit lifecycle code per hook.
 * Returns lifecycle code lines + the SET of indices CONSUMED in
 * clonedProgram.body (so emitResidualScriptBody can skip them) + the set of
 * `'svelte'` runtime imports the emitted code needs (`onMount` / `onDestroy`).
 *
 * Lowering rules (260519 linechart-watch-recreate Bug B + D-19 + Pitfall 4):
 *   - `$onMount` lowers to `onMount(...)` from `'svelte'` — NOT `$effect`.
 *     `$effect` is a TRACKING context: any reactive read inside the mount
 *     body (directly, or transitively via a helper call like `buildConfig()`
 *     reading `$props.data`) subscribes the mount effect, so it re-runs on
 *     every data change and recreates engine instances (LineChart's Chart.js
 *     `new Chart()` re-fired every tick). `onMount`'s callback runs OUTSIDE
 *     any tracking scope and runs exactly once — matching Vue's `onMounted`,
 *     Lit's `firstUpdated`, and Angular's `ngAfterViewInit`. `onMount`
 *     natively supports a cleanup-return.
 *   - `$onUnmount` (standalone) lowers to `onDestroy(...)` from `'svelte'`.
 *   - `$onMount` + adjacent `$onUnmount` identifier pair → ONE `onMount` that
 *     returns the cleanup (Modal lockScroll/unlockScroll D-19 anchor).
 *   - `$onUpdate` STAYS a `$effect` — it IS the update phase: re-run on every
 *     tracked reactive change. Svelte's `$effect` auto-tracks signal reads.
 */
function emitLifecycleHooks(
  clonedProgram: t.File,
): { lines: string[]; consumedIndices: Set<number>; runtimeImports: Set<string> } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  const runtimeImports = new Set<string>();

  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    if (consumed.has(i)) continue;
    const stmt = body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    // ROZ-cast-blindness fix — unwrap through any TS wrapper before the
    // CallExpression check, so `$onMount(...) as void` is still recognized.
    const expr = unwrapTsCast(stmt.expression);
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    const calleeName = expr.callee.name;
    if (
      calleeName !== '$onMount' &&
      calleeName !== '$onUnmount' &&
      calleeName !== '$onUpdate'
    ) {
      continue;
    }

    const arg = expr.arguments[0];
    if (!arg) continue;
    consumed.add(i);

    if (calleeName === '$onUpdate') {
      // Update phase: re-run on every reactive change. Svelte's $effect
      // auto-tracks signal reads — a plain $effect(setup) IS update phase.
      lines.push(`$effect(() => (${genCode(arg as t.Node)})());`);
      continue;
    }

    if (calleeName === '$onUnmount') {
      // Standalone unmount (no preceding mount paired earlier). `onDestroy`
      // from 'svelte' runs the callback once at teardown — no tracking scope.
      runtimeImports.add('onDestroy');
      lines.push(`onDestroy(() => (${genCode(arg as t.Node)})());`);
      continue;
    }

    // calleeName === '$onMount' — emit `onMount(...)`; check for a paired
    // $onUnmount OR an inline cleanup-return inside an arrow callback.
    runtimeImports.add('onMount');

    if (t.isIdentifier(arg)) {
      // Identifier-pair case (Modal lockScroll/unlockScroll).
      let pairedIdx: number | null = null;
      let pairedCleanupName: string | null = null;
      for (let j = i + 1; j < body.length; j++) {
        if (consumed.has(j)) continue;
        const next = body[j];
        if (!next) continue;
        if (!t.isExpressionStatement(next)) break;
        const nextExpr = next.expression;
        if (
          t.isCallExpression(nextExpr) &&
          t.isIdentifier(nextExpr.callee) &&
          nextExpr.callee.name === '$onUnmount'
        ) {
          const cleanupArg = nextExpr.arguments[0];
          if (cleanupArg && t.isIdentifier(cleanupArg)) {
            pairedIdx = j;
            pairedCleanupName = cleanupArg.name;
          }
        }
        break;
      }

      if (pairedIdx !== null && pairedCleanupName !== null) {
        consumed.add(pairedIdx);
        // Modal D-19 anchor: ONE onMount block per pair; onMount returns the
        // cleanup function (Svelte invokes it on destroy).
        lines.push(
          `onMount(() => {\n  ${arg.name}();\n  return () => ${pairedCleanupName}();\n});`,
        );
        continue;
      }

      // No paired unmount — bare `onMount(() => identifier())`.
      lines.push(`onMount(() => { ${arg.name}(); });`);
      continue;
    }

    // arg is an arrow/function — check for inline cleanup-return.
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      const fnBody = arg.body;
      let cleanupExpr: t.Expression | null = null;
      let setupBody: t.BlockStatement | null = null;

      if (t.isBlockStatement(fnBody) && !arg.async) {
        const lastStmt = fnBody.body[fnBody.body.length - 1];
        if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
          cleanupExpr = lastStmt.argument;
          setupBody = t.blockStatement(fnBody.body.slice(0, -1));
        }
      }

      if (cleanupExpr && setupBody) {
        // onMount(() => { setupBody; return cleanupExpr; })
        // Reconstruct: emit the setup statements + a return statement holding
        // the cleanup expression. onMount runs the callback once and uses the
        // returned function as the destroy-time cleanup.
        //
        // Phase 09 rebuild-site audit (Pattern 4): `t.blockStatement([...])`
        // reuses `setupBody.body` statements by reference — any author `TS*`
        // annotation on a declaration / param / catch binding inside the
        // lifecycle setup body survives verbatim. This rebuilds a
        // BlockStatement, not a function, so there is no `returnType` /
        // `typeParameters` to drop. Every cloned setup/cleanup arrow elsewhere
        // in this emitter is passed whole to `genCode` (param annotations
        // survive); Svelte has no `t.functionDeclaration` /
        // `t.arrowFunctionExpression` rebuild of a USER function.
        const merged = t.blockStatement([
          ...setupBody.body,
          t.returnStatement(cleanupExpr),
        ]);
        lines.push(`onMount(${arrowBody(merged)});`);
        continue;
      }

      // No cleanup — invoke the arrow body inline as the onMount callback.
      // arrowBody handles BlockStatement vs Expression bodies (incl. the
      // ObjectExpression paren-wrap case).
      lines.push(`onMount(${arrowBody(fnBody)});`);
      continue;
    }

    // Fallback: emit as IIFE inside onMount.
    lines.push(`onMount(() => (${genCode(arg as t.Node)})());`);
  }

  return { lines, consumedIndices: consumed, runtimeImports };
}

/**
 * Collect residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitDerivedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
 *
 * Returns both the joined code string AND the raw statement array so the
 * caller can generate a single-program source map via GEN_OPTS_MAP.
 */
function emitResidualScriptBody(
  clonedProgram: t.File,
  consumedLifecycleIndices: Set<number>,
  exposeNames: Set<string>,
): { code: string; stmts: t.Statement[] } {
  const stmts: t.Statement[] = [];
  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    if (!stmt) continue;
    if (consumedLifecycleIndices.has(i)) continue;

    // Skip VariableDeclarations whose declarators are ALL $computed initializers.
    // ROZ-cast-blindness fix — `d.init` unwraps through any TS wrapper before
    // the CallExpression check, so a cast-typed `$computed` is stripped too
    // (its `$derived(...)` re-emit already carries the cast — see
    // emitDerivedDecls above).
    if (t.isVariableDeclaration(stmt)) {
      const allComputed =
        stmt.declarations.length > 0 &&
        stmt.declarations.every((d) => {
          if (!d.init) return false;
          const call = unwrapTsCast(d.init);
          return (
            t.isCallExpression(call) &&
            t.isIdentifier(call.callee) &&
            call.callee.name === '$computed'
          );
        });
      if (allComputed) continue;

      // Phase 36 (REQ-32 / R6) — `const x = $inject('k', f?)` binders are
      // COMPILE-TIME directives consumed via ir.injects and re-emitted by
      // emitContext as `const x = getContext('k')[ ?? f]` in the preamble (init
      // scope). Strip them from the residual body so the bare `$inject`
      // identifier never leaks as an undefined runtime ref.
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

    // Skip lifecycle ExpressionStatements (defensive; should already be in consumed).
    // ROZ-cast-blindness fix — unwrap `stmt.expression` through any TS wrapper
    // before the CallExpression check, so e.g. `$onMount(...) as void` /
    // `($provide(...) as void)` is still recognized as the sigil and stripped.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(unwrapTsCast(stmt.expression))) {
      const callee = (unwrapTsCast(stmt.expression) as t.CallExpression).callee;
      if (t.isIdentifier(callee)) {
        if (
          callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate' ||
          // Quick plan 260515-u2b — $watch is consumed by emitWatcherHooks.
          callee.name === '$watch' ||
          // Phase 21 Plan 04 (REQ-6) — `$expose({...})` is a COMPILE-TIME
          // directive consumed via `ir.expose`; the matching `<script>`
          // functions are re-emitted below with an `export` modifier (Svelte 5
          // instance export). The `$expose(...)` call itself MUST be stripped
          // from the residual body — otherwise it leaks as an undefined-`$expose`
          // runtime reference. Mirrors the Vue + React strip.
          callee.name === '$expose' ||
          // Phase 36 (REQ-32 / R6) — `$provide('k', v)` is consumed via
          // ir.provides and re-emitted by emitContext as a native init-scope
          // `setContext('k', v)` call. Strip the directive so the bare
          // `$provide` ref never leaks at runtime. Mirrors the Vue strip.
          callee.name === '$provide'
        ) {
          continue;
        }
      }
    }

    stmts.push(stmt);
  }

  // Phase 55-04 — restore the inline-authored splice-boundary comment doubling
  // (and the boundary blank line) before per-statement generation below.
  mirrorSpliceBoundaryComments(stmts);

  // Phase 21 Plan 04 (REQ-6) — mark-and-export (RESEARCH §B.Svelte option b):
  // a top-level user function whose name is in the `$expose` set becomes a
  // Svelte 5 instance export by prepending `export `. Applies ONLY to matching
  // top-level declarations:
  //   - `function name(...) {...}`         → `export function name(...) {...}`
  //   - `const name = (...) => {...}` / fn → `export const name = ...`
  // svelte-check infers the instance-export handle types from the function
  // signature (D-04, no explicit interface). When `exposeNames` is empty no
  // statement matches, so output is byte-identical to today.
  const code = stmts
    .map((s) => {
      if (exposeNames.size > 0 && isExposedTopLevelDecl(s, exposeNames)) {
        // Emit the instance export at the AST level rather than string-prepending
        // `export ` to `genCode(s)`. A bare `export ${generated}` orphans the
        // keyword when the declaration carries LEADING COMMENTS: @babel/generator
        // emits the comment block before the `function`/`const` keyword, so the
        // prefix produces the invalid `export // comment\nfunction name()` (the
        // declaration is then NOT exported). Wrapping in an ExportNamedDeclaration
        // and moving the leading comments onto the wrapper keeps `export` adjacent
        // to the keyword: `// comment\nexport function name()`.
        const exportDecl = t.exportNamedDeclaration(s as t.Declaration);
        exportDecl.leadingComments = s.leadingComments ?? null;
        s.leadingComments = null;
        return genCode(exportDecl);
      }
      return genCode(s);
    })
    .join('\n');
  return { code, stmts };
}

/**
 * Phase 21 Plan 04 (REQ-6) — true when `stmt` is a top-level user declaration
 * whose declared name is in the `$expose` set:
 *   - a `FunctionDeclaration` `function name(...) {...}`, or
 *   - a single-declarator `const/let name = <arrow|function-expression>`.
 *
 * The locked accept-set (21-01) guarantees every exposed name resolves to a
 * top-level `<script>` `FunctionDeclaration` or an arrow/function-valued
 * `const` (or an inline arrow, which carries no name and is never matched
 * here). Only those forms are eligible for the instance-export prefix.
 */
function isExposedTopLevelDecl(stmt: t.Statement, exposeNames: Set<string>): boolean {
  if (t.isFunctionDeclaration(stmt) && stmt.id && t.isIdentifier(stmt.id)) {
    return exposeNames.has(stmt.id.name);
  }
  if (t.isVariableDeclaration(stmt) && stmt.declarations.length === 1) {
    const d = stmt.declarations[0]!;
    if (
      t.isIdentifier(d.id) &&
      d.init &&
      (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
    ) {
      return exposeNames.has(d.id.name);
    }
  }
  return false;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — true when any slot has isPortal.
   * Informational; the actual extra imports are already spliced into the
   * scriptBlock by emitScript.
   */
  hasPortals: boolean;
  /** The script body (without surrounding `<script lang="ts">` tags). */
  scriptBlock: string;
  /** Pending injections — Plan 02a Task 2/3 append to this. v1 always empty. */
  scriptInjections: SvelteScriptInjection[];
  /**
   * Phase 06.1 P2 (D-100/D-101): source map for user-authored statements
   * (residual body), produced by @babel/generator with sourceMaps:true via a
   * single-program generate call. Maps positions in the generated residual
   * text back to the original .rozie source lines. The shell adjusts this
   * map's generated line numbers by userCodeLineOffset so the final map
   * references the correct .svelte output line numbers. Null when there are
   * no residual statements or no filename was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Number of lines in all sections assembled BEFORE the residual (user-code)
   * section. Used by buildShell to compute userCodeLineOffset — the total
   * number of output lines before the user-authored statements begin.
   */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

/**
 * Phase 06.1 P2 emitScript options.
 */
export interface EmitScriptOptions {
  /**
   * .rozie filename surfaced as `sourceFileName` on @babel/generator's
   * per-call output map (D-103). Defaults to '<rozie>' when omitted.
   */
  filename?: string;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string (the default) when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  rewriteRozieIdentifiers(cloned, ir, diagnostics);

  // 3. Compute Svelte imports based on IR shape (slots → Snippet).
  const importSet = collectSvelteImports(ir);
  const importLines: string[] = [];
  if (importSet.typeImports.size > 0) {
    const sorted = [...importSet.typeImports].sort();
    importLines.push(`import type { ${sorted.join(', ')} } from 'svelte';`);
  }

  // Portal-slot primitive (Spike 003) — synthesize PortalHost-based portal
  // closure for portal slots. Imports `mount`/`unmount` from 'svelte' and
  // `PortalHost` from '@rozie/runtime-svelte/PortalHost.svelte'.
  const portalsEmit = emitPortals(ir, opts.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    importLines.push(portalsEmit.extraImports.trimEnd());
  }

  // 4. Emit blocks in canonical order.
  const propsBlock = emitPropsBlock(ir);
  const stateLines = emitStateDecls(ir);
  const refLines = emitRefDecls(ir);

  const { bodies: clonedComputedBodies, casts: clonedComputedCasts } =
    findClonedComputedBodies(cloned);
  const derivedLines = emitDerivedDecls(ir.computed, clonedComputedBodies, clonedComputedCasts);

  const {
    lines: lifecycleLines,
    consumedIndices,
    runtimeImports: lifecycleRuntimeImports,
  } = emitLifecycleHooks(cloned);
  // Quick plan 260515-u2b — $watch lowering (emits `$effect(() => {...})`).
  const {
    lines: watcherLines,
    consumedIndices: watcherConsumed,
    needsUntrack,
  } = emitWatcherHooks(cloned);
  for (const idx of watcherConsumed) consumedIndices.add(idx);

  // Cross-component context primitive (Phase 36 / REQ-32) — emit Svelte native
  // `setContext('k', v)` / `const x = getContext('k')[ ?? f]`. Reads
  // value/fallback expressions from the CLONED program so `$data`/`$props`/
  // `$refs` inside a provided value or inject fallback pick up the identifier
  // rewrites above. Empty-gated: contextEmit.hasContext is false (and nothing
  // is spliced) when the component has no $provide/$inject — preserving
  // byte-identity (R12/D-5).
  const contextEmit = emitContext(ir, cloned);

  // Phase 21 Plan 04 (REQ-6) — the set of `$expose`d names; drives both the
  // `$expose(...)` call strip and the `export ` instance-export prefix in
  // emitResidualScriptBody. Empty set → byte-identical residual body.
  const exposeNames = new Set(ir.expose.map((e) => e.name));
  const { code: residualCode, stmts: residualStmts } = emitResidualScriptBody(
    cloned,
    consumedIndices,
    exposeNames,
  );

  // Bug B fix (260519 linechart-watch-recreate) — assemble the `'svelte'`
  // value-import line. `onMount` / `onDestroy` are emitted by emitLifecycleHooks
  // for mount/unmount-phase hooks (non-tracking lifecycle); `untrack` is
  // emitted by emitWatcherHooks to keep the $watch callback's transitive
  // reactive reads out of the watcher's dependency set. Runes
  // ($props/$state/$derived/$effect/$bindable) need no import.
  const valueImports = new Set<string>([...lifecycleRuntimeImports]);
  if (needsUntrack) valueImports.add('untrack');
  // Phase 36 (REQ-32) — `setContext`/`getContext` join the single `'svelte'`
  // value-import line. Empty when the component has no $provide/$inject.
  for (const sym of contextEmit.svelteImports) valueImports.add(sym);
  if (valueImports.size > 0) {
    const sorted = [...valueImports].sort();
    importLines.push(`import { ${sorted.join(', ')} } from 'svelte';`);
  }

  // 5. Assemble preamble sections (everything BEFORE the residual user code).
  const preambleSections: string[] = [];
  if (importLines.length > 0) preambleSections.push(importLines.join('\n'));
  if (propsBlock) preambleSections.push(propsBlock);
  if (stateLines.length > 0) preambleSections.push(stateLines.join('\n'));
  if (refLines.length > 0) preambleSections.push(refLines.join('\n'));
  // Phase 36 (REQ-32) — inject binders (`const x = getContext('k')[ ?? f]`)
  // join the preamble AFTER refs and BEFORE the residual body, landing in
  // component INIT scope (where `$state`/`$derived` declarations live) so user
  // script + the template can reference the injected `const`. Counted into
  // preambleSectionLines automatically (source-map offset stays correct).
  if (contextEmit.injectLines.length > 0) {
    preambleSections.push(contextEmit.injectLines.join('\n'));
  }

  // Count lines in preamble sections so shell can compute userCodeLineOffset.
  // Each section is joined with '\n\n' between sections; count newlines total.
  // When there IS a residual section, `scriptBlock = preambleText + '\n\n' + residualCode`.
  // The '\n\n' separator contributes 2 newlines:
  //   - 1st '\n' terminates the last preamble line
  //   - 2nd '\n' creates a blank separator line
  // So lines before residual = (newlines_in_preambleText + 1 lines) + 1 blank = N + 2.
  const preambleText = preambleSections.join('\n\n');
  const preambleSectionLines = preambleText.length > 0
    ? (preambleText.match(/\n/g) ?? []).length + 2  // +2: last preamble line + blank separator
    : 0;

  // 6. Assemble in canonical order with blank-line separators.
  // Residual body BEFORE derived/effect — DX-03 trust-erosion: console.log
  // appears near the top of <script>; user-declared consts (e.g., handler
  // arrows) are visible to subsequent $derived / $effect references.
  const sections = [...preambleSections];
  if (residualCode.trim().length > 0) sections.push(residualCode);
  // Phase 36 (REQ-32) — `setContext('k', v)` calls emitted AFTER the residual
  // body so a provided value may reference residual-declared helpers (e.g.
  // `$provide('theme', { get color() {…}, cycle })` where `cycle` is a residual
  // `function`/`const`). CRITICAL: this is still component INIT scope — emitted
  // BEFORE the portal/lifecycle (`onMount`/`$effect`) blocks below, NEVER
  // inside a lifecycle callback, or Svelte throws "called outside component
  // initialization". The provided value carries the live getter/`$state`, so
  // descendants read reactive (D-3 / REQ-29).
  if (contextEmit.provideLines.length > 0) {
    sections.push(contextEmit.provideLines.join('\n'));
  }
  // Portal-slot primitive — emit portal scaffolding before lifecycle so the
  // `portals` closure is in scope when user $onMount callbacks fire.
  if (portalsEmit.hasPortals) sections.push(portalsEmit.setupLines);
  if (derivedLines.length > 0) sections.push(derivedLines.join('\n'));
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));
  // Quick plan 260515-u2b — watcher $effect blocks after lifecycle.
  if (watcherLines.length > 0) sections.push(watcherLines.join('\n'));

  const scriptBlock = sections.join('\n\n');

  // Generate a single-program source map for the residual (user-authored) statements.
  // These AST nodes carry correct .rozie line numbers from @babel/parser, so the
  // map produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the final
  // map references the correct .svelte output line numbers.
  let scriptMap: EncodedSourceMap | null = null;
  if (residualStmts.length > 0 && opts.filename) {
    const genResult = generate(
      t.file(t.program(residualStmts)),
      { ...GEN_OPTS_MAP, sourceFileName: opts.filename },
    );
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  return {
    hasPortals: portalsEmit.hasPortals,
    scriptBlock,
    scriptInjections,
    scriptMap,
    preambleSectionLines,
    diagnostics,
  };
}

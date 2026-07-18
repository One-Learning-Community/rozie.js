/**
 * emitScript — Phase 3 Plan 02 Task 2.
 *
 * Produces the body of `<script setup lang="ts">` for a Vue 3.4+ SFC. Output
 * order (per RESEARCH.md Pattern 3 + plan §<action>):
 *
 *   1. import { ... } from 'vue'        (auto-collected)
 *   2. withDefaults(defineProps<...>(), { ... })  (non-model props only — D-31)
 *   3. const X = defineModel<T>('X', { ... })     (per model prop — D-31, Pitfall 3)
 *   4. const emit = defineEmits<...>()            (only when ir.emits non-empty)
 *   5. defineSlots<...>()                         (only when ir.slots non-empty)
 *   6. const x = ref(initial)                     (per StateDecl — D-32)
 *   7. const xRef = ref<HTMLElement>()            (per RefDecl — Pitfall 4)
 *   8. const c = computed(() => body)             (per ComputedDecl — D-34)
 *   9. residual script body                       (helper-fn, plain-decl, console.log)
 *  10. onMounted/onBeforeUnmount/onUpdated calls  (D-33 + Pitfall 5/10)
 *
 * NOTE: residual-before-lifecycle ordering (since Plan 06) — earlier the doc
 * said lifecycle came BEFORE residual, but that triggered a JS TDZ crash on
 * `onMounted(lockScroll)` where `lockScroll` is a `const` declared in the
 * residual body (Modal.rozie repro). Vue's lifecycle registration doesn't
 * care which order setup executes the calls — it only cares that they fire
 * synchronously during setup, which both orderings satisfy.
 *
 * @rozie/runtime-vue imports for non-native modifiers (.outside / .debounce
 * / .throttle) come from Plan 04 (P3) which adds the listeners-block lowering
 * surface. Plan 02 emits ZERO non-native modifier code.
 *
 * Per CONTEXT D-30 hybrid codegen: <script> body is rewritten via
 * @babel/traverse over a CLONED Babel Program, then printed with
 * @babel/generator. The TOP-LEVEL string assembly is template-builder.
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
import { buildPropJsdoc, hasPropJsdoc } from '../../../../core/src/codegen/buildPropJsdoc.js';
import { resolveComponentRefs } from '../../../../core/src/codegen/resolveComponentRefs.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { VueImportCollector } from '../rewrite/collectVueImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitPortals } from './emitPortals.js';
import { emitContext } from './emitContext.js';
import { buildSlotTypeBlock } from './refineSlotTypes.js';
import { computeTsCastWrapText, unwrapTsCast } from '../../../../core/src/ast/unwrapTsCast.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations below (D-104/D-106)
// give those maps real positional content; non-annotated scaffolding nodes
// fall back to nearest-segment via the surrounding shell map (D-102).
//
// v1 limitation: emitScript assembles its output via string concatenation
// across multiple genCode calls (one per IR primitive). A single consolidated
// child map covering the whole script body would require building one
// t.Program and emitting once — large architectural change deferred. v1
// surfaces scriptMap=null and relies on the buildShell per-block accuracy
// (DX-04 P1 floor); the sourceMaps:true switch + .loc annotations give v2 a
// drop-in upgrade path.
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
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Why not `\`() => ${genCode(body)}\``? When `body` is an ObjectExpression
 * (e.g. user wrote `$computed(() => ({ x: 1 }))`), `genCode(body)` returns
 * `{ x: 1 }` and the surrounding template yields `() => { x: 1 }`, which
 * parses as an arrow with a BlockStatement body containing a LabeledStatement
 * `x: 1` — not an arrow returning an object literal. Building the arrow as a
 * Babel node and letting `@babel/generator` print it produces the correct
 * `() => ({ x: 1 })` automatically.
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

/**
 * ROZ-cast-blindness fix — render a `$computed` callback body as a
 * `() => ...` arrow, re-applying the author's original TS wrapper (`as T` /
 * `!` / `satisfies T`) around the callback's RETURN VALUE rather than around
 * the whole `computed(...)` call. Vue's `computed()` returns a
 * `ComputedRef<T>` wrapper (read via `.value`) — casting THAT to `T` is a
 * genuine type error (TS2352), and every downstream `.value` read still
 * expects the wrapper. Casting the return value keeps `ComputedRef<T>`
 * intact while still typing the produced value. No cast → byte-identical to
 * plain `arrowBody(body)`.
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

/**
 * Phase 55-04 (literal byte-identity) — reproduce the inline-authored comment
 * doubling at a script-partial splice boundary.
 *
 * In an inline-authored `<script>`, a comment block BETWEEN two statements is
 * attached by `@babel/parser` to BOTH neighbours (the earlier statement's
 * `trailingComments` AND the later statement's `leadingComments`). The `.rzts`
 * script-partial splice attaches the boundary banner ONLY to the spliced node's
 * `leadingComments` — the preceding statement lives in a different source file and
 * carries no matching trailing comment. Vue emits the residual body one statement
 * at a time (`stmts.map((s) => genCode(s)).join('\n')`), so each `genCode` call has
 * its own comment-dedup set: in the inline form the boundary banner therefore
 * prints TWICE (once as the previous statement's trailing, once as the next
 * statement's leading), with a blank line after the previous closing brace.
 * Re-mirroring the spliced node's leading comments back onto the preceding
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
 * Render a PropTypeAnnotation as a TypeScript type string.
 *
 * Reference examples produce these patterns:
 *   - { kind: 'identifier', name: 'Number' }   → 'number'
 *   - { kind: 'identifier', name: 'String' }   → 'string'
 *   - { kind: 'identifier', name: 'Boolean' }  → 'boolean'
 *   - { kind: 'identifier', name: 'Array' }    → 'any[]'
 *   - { kind: 'identifier', name: 'Object' }   → 'Record<string, any>'
 *   - { kind: 'identifier', name: 'Function' } → '((...args: any[]) => any)'  (| null added only on default:null)
 *   - { kind: 'union', members: [...] }        → join with ' | '
 *   - { kind: 'literal', value: 'string' }     → 'string'
 *
 * Other identifier names pass through verbatim (e.g., user-declared interface
 * names) — TS will validate at consumer compile time.
 *
 * Why `any[]` / `Record<string, any>` (not `unknown[]` / `unknown`): the
 * PropTypeAnnotation carries no inner-element/inner-property info, so under
 * `unknown` every template expression `item.id` or `props.node.label` fails
 * with TS18046 ("X is of type 'unknown'"). `any` keeps consumer-side template
 * expressions ergonomic without requiring inner-type annotations in the rozie
 * source. Matches the Solid/Lit fix from commit 536575a (vue-tsc gate).
 *
 * Function renders as the bare `((...args: any[]) => any)`. The `| null` is NOT
 * baked in here (Spike-012 R5, C5): a `default: null` Function prop (Card.rozie,
 * CardHeader.rozie — `withDefaults(..., { onClose: null })`) gets the `| null`
 * widening from the caller's NullLiteral-default gate (`renderPropField` /
 * `emitDefineModels`), exactly as the canonical `.d.ts` path does
 * (renderPropsInterface.ts). A required / non-null-default Function prop stays
 * non-null so it binds cleanly to an element event slot under strictNullChecks.
 */
function renderType(t: PropTypeAnnotation): string {
  if (t.kind === 'identifier') {
    switch (t.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'any[]';
      case 'Object':
        return 'Record<string, any>';
      case 'Function':
        // Spike-012 R5 (C5, closes R4-D): NO unconditional `| null`. The `| null`
        // widening is added by `renderPropField` / `emitDefineModels` ONLY when
        // the prop declares an explicit `default: null` (NullLiteral) — mirroring
        // the canonical `.d.ts` path (renderPropsInterface.ts). Previously every
        // Function prop got `| null`, which (a) diverged from the published .d.ts
        // and (b) fails to bind a required / non-null-default Function prop to an
        // element event slot under strictNullChecks (TS2345).
        return '((...args: any[]) => any)';
      default:
        return t.name; // Pass through user-declared types verbatim.
    }
  }
  if (t.kind === 'union') {
    return t.members.map(renderType).join(' | ');
  }
  if (t.kind === 'literal') {
    // 'string'|'number'|'boolean'|'function'|'object'|'array'
    if (t.value === 'array') return 'any[]';
    if (t.value === 'object') return 'Record<string, any>';
    if (t.value === 'function') return '((...args: any[]) => any)'; // R5 C5 — see Function case above.
    return t.value;
  }
  // Should be exhaustive — but fall back to 'unknown' for safety.
  return 'unknown';
}

/**
 * True when the prop has an explicit `default: null` in the `.rozie` source —
 * i.e. `prop.defaultValue` is a `NullLiteral` node (NOT the `null`-the-absence
 * sentinel, which is `prop.defaultValue === null`). When true, the emitted
 * field type must be widened to `... | null` so the `withDefaults` `null`
 * default is assignable. Mirrors the Angular target's `hasExplicitNullDefault`.
 * Quick task 260520-w18 bug class 3.
 */
function hasExplicitNullDefault(prop: PropDecl): boolean {
  return prop.defaultValue !== null && t.isNullLiteral(prop.defaultValue);
}

/**
 * Render a non-model prop's `name?: type` field for the defineProps type
 * literal, widening to `... | null` when the prop declares `default: null`.
 *
 * Quick task 260520-w18 bug class 3 — `{ type: String, default: null }` would
 * otherwise emit `withDefaults(defineProps<{ x?: string }>(), { x: null })`,
 * and `null` is not assignable to `InferDefault<…, string | undefined>`
 * (TS2322). `renderType` already appends `| null` for `Function`-typed props,
 * so the widening is suppressed when the rendered type already ends in
 * `| null` to avoid a double suffix.
 */
function renderPropField(p: PropDecl): string {
  let baseType = renderType(p.typeAnnotation);
  const needsNull =
    hasExplicitNullDefault(p) && !/\|\s*null$/.test(baseType.trimEnd());
  // Quick task 260623-kks — `{ type: null, default: null }` (an untyped
  // object-passthrough prop) lowers to `{ kind: 'identifier', name: 'unknown' }`,
  // so `renderType` returns the literal string `'unknown'`. Widening that to
  // `unknown | null` is a TRAP: TS collapses `unknown | null` → `unknown`, and
  // Vue's `withDefaults` `InferDefault<P, unknown>` then resolves the default
  // slot to `((props) => {}) | undefined`, which REJECTS the `null` default in
  // the generated `withDefaults(..., { obj: null })` object → TS2322 (29× in the
  // data-table Vue leaf dogfood). Substitute a NON-collapsing object-ish base
  // (`Record<string, any>` — the same type `renderType` already emits for
  // `Object`/`'object'`): `Record<string, any> | null` keeps both union
  // branches, is opaque-passthrough-ergonomic, and parallels the working
  // Function case `((...args: any[]) => any) | null`. Type-only fix; gated to
  // the collapsing case so every other field stays byte-identical.
  if (needsNull && baseType === 'unknown') {
    baseType = 'Record<string, any>';
  }
  const finalType = needsNull ? `${baseType} | null` : baseType;
  // 260521-oao — `p.required` is the SOLE optionality determinant: a
  // `required: true` prop drops the `?` and emits a non-optional field.
  const opt = p.required ? '' : '?';
  return `${p.name}${opt}: ${finalType}`;
}

/**
 * Phase 16 audit finding — D-02 once-per-instance factory caching CANNOT be
 * applied to Vue's emit. Vue's `compiler-sfc` requires `withDefaults`'s
 * second argument to be a STATIC object literal — references to module-
 * scope vars (the natural cache-target for D-02) raise "scope reference"
 * compile errors ("are not allowed to reference variables declared in the
 * outer scope"). This is a fundamental limitation of Vue's static SFC
 * analysis (compiler-sfc walks the `withDefaults` arg AST to extract
 * defaults for the static defineProps macro transformation, and rejects
 * any Identifier reference outside the static literal). Same constraint
 * blocks `() => __defaultE`, `() => sharedDefault`, etc.
 *
 * Vue 3.4 (the project floor per CLAUDE.md) consequently invokes factory
 * defaults on every render via `resolvePropValue` in `setFullProps`, so
 * `props.e !== props.e` across consecutive renders on Vue. Vue 3.5 added
 * native factory caching (vuejs/core#11668) — consumers on Vue 3.5+ get
 * D-02 satisfaction automatically. Consumers on Vue 3.4 hit the per-render
 * factory re-invocation; the workaround is to upgrade to Vue 3.5+.
 *
 * The PropDefaultCoercion Vue runtime probe accordingly tests Vue-specific
 * behavior: it asserts only the JSON-substring contract (R1 primitive
 * coercion) — NOT the identity probe (which would require D-02 caching the
 * Vue emit can't deliver).
 */
/**
 * Phase 58 Plan 04 (SC-3) — render the BODY of the props type literal
 * (`{ … }`) for `defineProps<{ … }>` / `interface FooProps { … }`.
 *
 * Open Question 1 (resolved empirically against the data-table Vue pilot +
 * vue-tsc): Vue's compact `{ a?: A; b?: B }` one-line literal cannot host an
 * inline JSDoc comment inside a `;`-joined member list. Strategy A — restructure
 * to a MULTI-LINE member literal, each documented member preceded by its gated
 * `buildPropJsdoc` block — IS accepted by vue-tsc (a JSDoc comment is legal
 * inside a `{ … }` TS type literal exactly as in an `interface` body). This is
 * also the surface vue-tsc + IDE hover read for SFC consumers (Vue's `compile()`
 * output carries NO `.d.rozie.ts`; the SFC `defineProps<T>()` IS the consumer
 * type surface — see compile.ts D-84), so the JSDoc must live here, not only in
 * the sidecar `.d.rozie.ts`.
 *
 * GATING (SC-5 byte-identity): the multi-line restructure fires ONLY when at
 * least one prop in the set carries `docs`. A fully-docless set returns the
 * exact existing compact `${fields.join('; ')}` form — zero whitespace drift,
 * byte-identical to today (T-58-07). `innerIndent` is the indent applied to each
 * member line in the multi-line form (matching the `{ … }` open's column).
 */
function renderPropsTypeBody(
  nonModel: readonly PropDecl[],
  fields: readonly string[],
  closeIndent: string,
): string {
  // Gate on the presence predicate, NOT on `buildPropJsdoc(p) !== ''` with a
  // throwaway indent — the empty/non-empty decision is indent-independent and
  // must stay decoupled from the builder's output format (WR-02). `hasPropJsdoc`
  // is the single source of truth shared with `buildPropJsdoc` itself.
  const hasDocs = nonModel.some((p) => hasPropJsdoc(p));
  if (!hasDocs) {
    // Byte-identical compact one-line form for fully-docless prop sets.
    return `{ ${fields.join('; ')} }`;
  }
  // Multi-line form: each member on its own line (terminated with `;`), the
  // documented ones preceded by their gated JSDoc block. `buildPropJsdoc`
  // returns a trailing-newline block, so the JSDoc lands directly above the
  // member. vue-tsc accepts JSDoc inside a `{ … }` type literal. Members are
  // indented one level (2 spaces) past the literal's closing brace.
  const innerIndent = `${closeIndent}  `;
  const memberLines = nonModel.map((p, i) => {
    const jsdoc = buildPropJsdoc(p, innerIndent);
    return `${jsdoc}${innerIndent}${fields[i]};`;
  });
  return `{\n${memberLines.join('\n')}\n${closeIndent}}`;
}

function emitPropsDecl(
  ir: IRComponent,
  genericParams?: readonly string[],
): string {
  const nonModel = ir.props.filter((p) => !p.isModel);
  const generics =
    genericParams && genericParams.length > 0
      ? `<${genericParams.join(', ')}>`
      : '';

  if (nonModel.length === 0) {
    // Generic components with NO non-model props still need a typed
    // `defineProps<FooProps<T>>()` so consumers can pass the type argument.
    // But if there are no model props EITHER, emitDefineModels will emit
    // nothing too — which means the SFC has no defineProps at all and the
    // generic attribute on <script setup> is effectively unused. This
    // is fine for v1: the only generic fixture (Select<T>) has a model prop
    // so defineModel<T> uses T.
    return '';
  }

  // Both the generic-mode interface branch and the non-generic inline-literal
  // branch build from this single `fields` array, so widening here covers both.
  const fields = nonModel.map(renderPropField);

  // Build the defaults object — only include props with non-null defaultValue.
  // Phase 16 audit finding documented in the function block comment above:
  // Vue's compiler-sfc rejects scope references inside withDefaults, so the
  // D-02 once-per-instance factory-cache pattern cannot be applied here.
  // Factory defaults are passed through verbatim; Vue 3.4 re-invokes them
  // per render (Vue 3.5+ caches natively via vuejs/core#11668).
  const defaultsEntries: string[] = [];
  for (const p of nonModel) {
    if (p.defaultValue !== null) {
      defaultsEntries.push(`${p.name}: ${genCode(p.defaultValue)}`);
    }
  }

  // Generic-mode: hoist a named interface so `defineProps<SelectProps<T>>()`
  // resolves T against the enclosing <script setup generic="T"> attribute.
  if (generics.length > 0) {
    // SC-3: a documented prop set restructures the interface body to multi-line
    // members so each can carry its JSDoc block; docless sets stay the compact
    // one-line `{ a?: A; b?: B }` form (byte-identical). Interface members sit
    // at the 2-space class/interface-body indent.
    const interfaceLine = `interface ${ir.name}Props${generics} ${renderPropsTypeBody(nonModel, fields, '')}`;
    if (defaultsEntries.length === 0) {
      return (
        `${interfaceLine}\n` +
        `const props = defineProps<${ir.name}Props${generics}>();`
      );
    }
    return (
      `${interfaceLine}\n` +
      `const props = withDefaults(\n` +
      `  defineProps<${ir.name}Props${generics}>(),\n` +
      `  { ${defaultsEntries.join(', ')} }\n` +
      `);`
    );
  }

  // Non-generic mode (existing Phase 3 shape — byte-identical for the 5
  // reference examples that never set genericParams). SC-3: a documented prop
  // set restructures the inline `defineProps<{ … }>` literal to multi-line
  // JSDoc'd members; a docless set stays the compact one-line form.
  if (defaultsEntries.length === 0) {
    // `defineProps<` opens at column 0 → closing brace at column 0.
    return `const props = defineProps<${renderPropsTypeBody(nonModel, fields, '')}>();`;
  }

  return (
    `const props = withDefaults(\n` +
    // `defineProps<` is at 2-space indent → closing brace at 2-space indent.
    `  defineProps<${renderPropsTypeBody(nonModel, fields, '  ')}>(),\n` +
    `  { ${defaultsEntries.join(', ')} }\n` +
    `);`
  );
}

/**
 * Emit one `const X = defineModel<T>('X', { default: ... })` per model prop.
 * Per Pitfall 3: model props are EXCLUDED from defineProps.
 */
function emitDefineModels(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const p of ir.props) {
    if (!p.isModel) continue;
    // Spike-012 R5 (C5) — `renderType` no longer bakes `| null` into a Function
    // type, so a model prop declaring an explicit `default: null` gets the
    // widening here, matching the non-model `renderPropField` gate and the
    // canonical `.d.ts` path. (Zero corpus impact — no shipped model prop pairs
    // `type: Function`/`default: null`; only correctness for that shape.)
    const baseType = renderType(p.typeAnnotation);
    const tsType = hasExplicitNullDefault(p) ? `${baseType} | null` : baseType;
    // SC-3: prepend the gated JSDoc block above the `defineModel` line for a
    // documented model prop. `buildPropJsdoc('')` builds the block at zero
    // indent (model lines sit at column 0 in the <script setup> body) with a
    // trailing newline, so splicing it directly onto the front of the line puts
    // the JSDoc immediately above the `const X = defineModel…` statement. A
    // docless model prop gets `''` → byte-identical to today (SC-5).
    const jsdoc = buildPropJsdoc(p, '');
    if (p.defaultValue !== null) {
      // A defaulted model prop is optional regardless of `required`
      // (260521-oao — `required: true` + `default:` is dropped upstream in
      // lowerProps, so a defaultValue here means the prop was NOT required).
      const dflt = genCode(p.defaultValue);
      lines.push(
        `${jsdoc}const ${p.name} = defineModel<${tsType}>('${p.name}', { default: ${dflt} });`,
      );
    } else if (p.required) {
      // 260521-oao — a required no-default model prop emits the Vue
      // `required: true` options form so the consumer MUST pass it.
      lines.push(
        `${jsdoc}const ${p.name} = defineModel<${tsType}>('${p.name}', { required: true });`,
      );
    } else {
      lines.push(
        `${jsdoc}const ${p.name} = defineModel<${tsType}>('${p.name}');`,
      );
    }
  }
  return lines;
}

/**
 * Emit `const emit = defineEmits<{ event: [...args: any[]]; ... }>()` if
 * ir.emits is non-empty. v1: emit args typed as `[...args: any[]]` since IR
 * doesn't carry per-emit arg types (TYPES-01 lands in Phase 6).
 */
function emitDefineEmitsCall(ir: IRComponent): string {
  if (ir.emits.length === 0) return '';
  // Quote hyphenated/dotted event names — Vue's `defineEmits<{ ... }>` type
  // literal is just a TS type, so kebab-case keys like `event-click` need
  // string-literal property keys. Plain identifier characters (letters,
  // digits, underscore, leading-non-digit) pass through unquoted to keep
  // simple cases readable.
  const lines = ir.emits
    .map((e) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(e) ? e : `'${e}'`;
      return `  ${key}: [...args: any[]];`;
    })
    .join('\n');
  return `const emit = defineEmits<{\n${lines}\n}>();`;
}

/**
 * Phase 21 (REQ-4) — emit `defineExpose({ reset, focus });` if ir.expose is
 * non-empty, mirroring `emitDefineEmitsCall`. `defineExpose` is a Vue compiler
 * macro (NO import). The names are joined in source order; Vue infers the handle
 * types from the referenced function declarations (D-04 — no explicit interface).
 * Byte-identical-when-empty: returns '' (and emitVue assembly appends nothing)
 * so non-`$expose` Vue output is unchanged.
 */
function emitDefineExposeCall(ir: IRComponent): string {
  if (ir.expose.length === 0) return '';
  const names = ir.expose.map((e) => e.name).join(', ');
  return `defineExpose({ ${names} });`;
}

/**
 * Emit `defineSlots<...>()` if ir.slots is non-empty. Plan 03 refines from the
 * Plan 02 `props: any` stub to per-param `{ paramName: any; ... }` literals via
 * `buildSlotTypeBlock` (refineSlotTypes.ts). Param value types remain `any` for
 * v1 — TYPES-01 in Phase 6 will refine when the type-flow pass lands.
 */
function emitDefineSlotsStub(ir: IRComponent): string {
  if (ir.slots.length === 0) return '';
  const lines = buildSlotTypeBlock(ir.slots);
  return `defineSlots<{\n${lines}\n}>();`;
}

/**
 * Emit `const X = ref(initializer)` per StateDecl (D-32).
 */
function emitDataRefs(ir: IRComponent, imports: VueImportCollector): string[] {
  const lines: string[] = [];
  for (const s of ir.state) {
    imports.use('ref');
    // Quick task 260520-w18 bug class 2 — an empty-array `<data>` initializer
    // (`files: []`) types as `ref<never[]>`, so `files.value.map(f => f.id)`
    // fails TS2339 ("Property 'id' does not exist on type 'never'"). Engine
    // wrappers routinely seed a `$data` array empty and let the engine
    // populate it. Annotate the empty-array literal case as `any[]`.
    //
    // Phase 16-04 — `<data>` `null` initializer types as `ref<null>`, so
    // `x.value = <number>` fails TS2322. SortableList keyboard re-land uses
    // `liftedIndex: null` and assigns a number. Mirrors the Angular signal +
    // React useState + Svelte $state widenings — annotate as `<any>`.
    let refTypeArg = '';
    if (t.isArrayExpression(s.initializer) && s.initializer.elements.length === 0) {
      refTypeArg = '<any[]>';
    } else if (t.isNullLiteral(s.initializer)) {
      refTypeArg = '<any>';
    }
    // Quick 260717-uvl (ROZ208 make-it-work) — route the initializer through
    // rewriteTemplateExpression (the SAME machinery already used to lower
    // `$props.X`/`$data.X` in templates/handlers) so a `<data>` initializer
    // that reads `$props.x`/`$data.x` (the idiomatic Vue-port derived-initial
    // pattern) lowers to `props.x`/the bare local instead of leaking the raw
    // sigil (TS2304 + runtime ReferenceError). DESIGN CAVEAT: this SNAPSHOTS
    // the prop/data value at mount and does not track later changes (the
    // derived-state footgun, uniform across all six targets) — an `$onMount`
    // seed remains the honest REACTIVE form; this only makes the snapshot
    // form work.
    const initText = initializerHasLeakingSigil(s.initializer)
      ? rewriteTemplateExpression(stripInitializerComments(s.initializer), ir)
      : genCode(s.initializer);
    lines.push(`const ${s.name} = ref${refTypeArg}(${initText});`);
  }
  return lines;
}

/**
 * Emit `const Xref = ref<TagType>()` per RefDecl. Per Pitfall 4 the variable
 * name has a `Ref` suffix to avoid collisions with <data>/<computed>/<props>
 * declarations of the same name.
 *
 * Element-tag → DOM type guess:
 *   - 'input' / 'textarea' / 'select' → corresponding HTML*Element
 *   - everything else → HTMLElement
 *
 * v1 acceptable simplification — Phase 6 TYPES-01 may refine.
 */
function emitTemplateRefs(ir: IRComponent, imports: VueImportCollector): string[] {
  const lines: string[] = [];
  // Phase 66 (D-2 component-INSTANCE route, SC-2): a ref that points at a
  // `<components>`-composed CHILD is typed as the child's component INSTANCE via
  // `ref<InstanceType<typeof Child>>()`, so `$refs.child.exposedMethod()`
  // typechecks. Vue's shipped `.d.ts` types the component as
  // `DefineComponent<Props, { focus; clear; … }>`, so `InstanceType` carries the
  // `defineExpose` members. The child is ALREADY imported by the Vue shell's
  // component-import synthesis (emitVue.ts:410 `import Child from '...'`), so
  // `typeof Child` resolves in-scope — NO Handle import, NO `codegen.mjs` change.
  // The shared core resolver returns NOTHING for a DOM ref, so the DOM `switch`
  // below runs UNCHANGED for every non-composed ref (byte-identity carve-out).
  const componentRefs = resolveComponentRefs(ir);
  for (const r of ir.refs) {
    imports.use('ref');
    const componentLocalName = componentRefs.get(r.name);
    if (componentLocalName !== undefined) {
      lines.push(
        `const ${r.name}Ref = ref<InstanceType<typeof ${componentLocalName}>>();`,
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
    lines.push(`const ${r.name}Ref = ref<${domType}>();`);
  }
  return lines;
}

/**
 * Emit `const X = computed(() => body)` per ComputedDecl (D-34).
 *
 * Body comes from `c.body` which is either an Expression or a BlockStatement.
 * For Expression bodies → `() => expression`.
 * For BlockStatement bodies → `() => { stmts; }`.
 *
 * Per IR-01: computed entries' `body` fields point to the SAME nodes referenced
 * from ir.setupBody.scriptProgram (referential equality with original tree).
 * To pick up our identifier rewrites, we must use the CLONED versions.
 */
function emitComputedDecls(
  computedDecls: ComputedDecl[],
  cloneClonedComputedBodies: Map<string, t.Expression | t.BlockStatement>,
  imports: VueImportCollector,
  clonedComputedCasts: Map<string, { prefix: string; suffix: string }>,
): string[] {
  const lines: string[] = [];
  for (const c of computedDecls) {
    imports.use('computed');
    const body = cloneClonedComputedBodies.get(c.name) ?? c.body;
    // Per D-34: wrap the rewritten body in `computed(() => ...)` so the emitted
    // decl is a Vue Ref<T>. Read-side `.value` access is appended by
    // rewriteRozieIdentifiers' Identifier visitor in templates / scripts.
    // genCode handles both BlockStatement (`{ return x; }`) and Expression (`x`)
    // bodies correctly — the if/else was dead code (both branches identical).
    // ROZ-cast-blindness fix — renderComputedArrow re-applies the author's
    // original TS wrapper around the callback's return value (see its doc).
    const cast = clonedComputedCasts.get(c.name);
    lines.push(`const ${c.name} = computed(${renderComputedArrow(body, cast)});`);
  }
  return lines;
}

/**
 * Walk the cloned program's top-level body and locate, for each ComputedDecl
 * by name, the corresponding initializer expression in the clone (post-rewrite).
 *
 * The clone preserves source-order indices, so we walk and match VariableDeclarator
 * id.name === computed.name where the initializer is a CallExpression to $computed
 * (the arrow's body is the body we want).
 *
 * ROZ-cast-blindness fix — `d.init` unwraps through any TS wrapper (`as T` /
 * `!` / `satisfies T` / `<T>`) before the CallExpression check, so
 * `const label = $computed(() => ...) as string` is still recognized. The
 * cast text is captured per name (`casts`) so `emitComputedDecls` can
 * re-wrap the emitted `computed(...)` read in it.
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
 * Emit lifecycle hook calls. Walks the CLONED program (so rewrites are picked
 * up in setup/cleanup bodies) and pairs adjacent $onMount/$onUnmount Identifier
 * pairs per Phase 2 D-19 / RESEARCH.md Pattern 4 / Pitfall 10.
 *
 * Pitfall 5 cross-scope cleanup pattern fires when an arrow $onMount returns a
 * cleanup function — the cleanup is hoisted via `let _cleanup_N` indirection
 * so the cleanup callback can capture vars from the mount-time scope.
 *
 * @returns lifecycle code lines + the SET of indices CONSUMED in clonedProgram.body
 *          (so emitResidualScriptBody can skip them).
 */
/**
 * Quick plan 260515-u2b — emit `watch(getter, cb)` per WatchHook.
 *
 * Vue's `watch(getterFn, cb)` is a perfect 1:1 lowering for our IR shape:
 * the getter runs once during registration and again whenever any reactive
 * value it READS changes; the callback fires on the resulting value
 * transition.
 *
 * The WatchHook stores function BODIES (getter/callback) — we wrap each back
 * into an ArrowFunctionExpression before genCode so we emit
 * `watch(() => open, () => { reposition(); })`, not `watch({ ... }, { ... })`.
 *
 * Walks the CLONED program (lifecycle scan already consumed lifecycle
 * indices) so $props/$data/$refs rewrites are picked up automatically.
 * Locates each $watch call by source-order, then synthesizes the arrow
 * wrappers around the original rewritten function-body nodes.
 */
/**
 * 260602-9lw — detect a literal `{ immediate: true }` third argument on a cloned
 * `$watch(...)` call. Mirrors the collector's parse discipline (Identifier or
 * StringLiteral key `immediate`, BooleanLiteral `true` value; any other shape
 * defaults to lazy). The collector already validated this at the IR layer; we
 * re-read it from the cloned AST here because emitWatcherHooks walks the cloned
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
  imports: VueImportCollector,
): { lines: string[]; consumedIndices: Set<number> } {
  const lines: string[] = [];
  const consumed = new Set<number>();
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
    imports.use('watch');
    consumed.add(i);
    // The cloned getter / callback nodes are ALREADY arrow/function expressions
    // with their bodies rewritten in-place by rewriteRozieIdentifiers. We can
    // emit them verbatim — no body-extraction needed.
    const getterCode = genCode(getterArg as t.Node);
    const cbCode = genCode(cbArg as t.Node);
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). Vue's `watch(getter, cb)` is
    // natively lazy (first callback on the next change, not on registration), so
    // the default emit is the bare lazy form. The author opts into the eager
    // initial fire with `$watch(getter, cb, { immediate: true })`, which we
    // detect from the cloned call's third argument (literal `{ immediate: true }`).
    if (watchCallIsImmediate(expr)) {
      lines.push(`watch(${getterCode}, ${cbCode}, { immediate: true });`);
    } else {
      lines.push(`watch(${getterCode}, ${cbCode});`);
    }
  }
  return { lines, consumedIndices: consumed };
}

function emitLifecycleHooks(
  clonedProgram: t.File,
  imports: VueImportCollector,
): { lines: string[]; consumedIndices: Set<number> } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  let cleanupCounter = 0;

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
      imports.use('onUpdated');
      // Setup-only hook for update phase.
      lines.push(`onUpdated(${genCode(arg as t.Node)});`);
      continue;
    }

    if (calleeName === '$onUnmount') {
      // Standalone unmount (no preceding mount paired earlier).
      imports.use('onBeforeUnmount');
      lines.push(`onBeforeUnmount(${genCode(arg as t.Node)});`);
      continue;
    }

    // calleeName === '$onMount' — emit onMounted; check for paired $onUnmount
    // OR for an inline cleanup-return inside an arrow callback (Pitfall 5).
    imports.use('onMounted');

    if (t.isIdentifier(arg)) {
      // Identifier-pair case (Modal lockScroll/unlockScroll).
      // Peek next non-consumed ExpressionStatement — if it's $onUnmount(Identifier)
      // adjacent in source order, pair them: emit `onMounted(setup); onBeforeUnmount(cleanup);`
      let pairedIdx: number | null = null;
      for (let j = i + 1; j < body.length; j++) {
        if (consumed.has(j)) continue;
        const next = body[j];
        if (!next) continue;
        // Skip pure-helper-decl statements? No — adjacency is at lifecycle level.
        // We only pair if the very next ExpressionStatement is $onUnmount(Identifier).
        if (!t.isExpressionStatement(next)) {
          // Not an expression — break (adjacency rule).
          // But Phase 2 pairs only when truly adjacent at the source-call level.
          // Leave conservative: do NOT skip helper decls; require strict adjacency.
          break;
        }
        const nextExpr = next.expression;
        if (
          t.isCallExpression(nextExpr) &&
          t.isIdentifier(nextExpr.callee) &&
          nextExpr.callee.name === '$onUnmount'
        ) {
          const cleanupArg = nextExpr.arguments[0];
          if (cleanupArg && t.isIdentifier(cleanupArg)) {
            pairedIdx = j;
          }
        }
        break;
      }

      if (pairedIdx !== null) {
        consumed.add(pairedIdx);
        const pairedStmt = body[pairedIdx]!;
        if (t.isExpressionStatement(pairedStmt) && t.isCallExpression(pairedStmt.expression)) {
          const cleanupArg = pairedStmt.expression.arguments[0]!;
          imports.use('onBeforeUnmount');
          lines.push(`onMounted(${genCode(arg as t.Node)});`);
          lines.push(`onBeforeUnmount(${genCode(cleanupArg as t.Node)});`);
          continue;
        }
      }

      // No paired unmount — just onMounted(identifier).
      lines.push(`onMounted(${genCode(arg as t.Node)});`);
      continue;
    }

    // arg is an arrow/function — check for inline cleanup-return (Pitfall 5).
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      const fnBody = arg.body;
      // Cleanup-return: BlockStatement whose last statement is `return <expr>;`
      let cleanupExpr: t.Expression | null = null;
      let setupBody: t.BlockStatement | t.Expression = fnBody;
      let async = false;
      if (arg.async) async = true;

      if (t.isBlockStatement(fnBody) && !async) {
        const lastStmt = fnBody.body[fnBody.body.length - 1];
        if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
          cleanupExpr = lastStmt.argument;
          // Strip the return statement from the setup body for emission.
          setupBody = t.blockStatement(fnBody.body.slice(0, -1));
        }
      }

      if (cleanupExpr) {
        // Pitfall 5: cross-scope-cleanup pattern.
        const N = cleanupCounter++;
        imports.use('onBeforeUnmount');

        // Render setup body as `() => { ...; _cleanup_N = <cleanupExpr>; }`.
        // Strategy: prepend assignment of the cleanup to _cleanup_N inside the setup body.
        //
        // Phase 09 rebuild-site audit (Pattern 4): `t.blockStatement([...])`
        // here reuses `setupBlock.body` statements by reference, so any author
        // `TS*` annotation on a declaration / param / catch binding inside the
        // lifecycle setup body survives verbatim. This path rebuilds a
        // BlockStatement, not a function — no `returnType` / `typeParameters`
        // to drop. The cloned setup/cleanup arrows elsewhere in this emitter
        // are passed whole to `genCode`, so their param annotations survive
        // too. Vue has no `t.functionDeclaration` / `t.arrowFunctionExpression`
        // rebuild of a USER function — no annotation-dropping site exists.
        const setupBlock = t.isBlockStatement(setupBody) ? setupBody : t.blockStatement([t.expressionStatement(setupBody)]);
        // Append assignment to _cleanup_N.
        const assign = t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.identifier(`_cleanup_${N}`),
            cleanupExpr,
          ),
        );
        const newBlock = t.blockStatement([...setupBlock.body, assign]);

        lines.push(`let _cleanup_${N}: (() => void) | undefined;`);
        lines.push(`onMounted(() => ${genCode(newBlock)});`);
        lines.push(`onBeforeUnmount(() => { _cleanup_${N}?.(); });`);
        continue;
      }

      // No cleanup — emit onMounted(setupExpr).
      lines.push(`onMounted(${genCode(arg as t.Node)});`);
      continue;
    }

    // Fallback: emit verbatim (e.g., a CallExpression returning a fn).
    lines.push(`onMounted(${genCode(arg as t.Node)});`);
  }

  return { lines, consumedIndices: consumed };
}

/**
 * Collect residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitComputedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
 *
 * Per CONTEXT D-30: this preserves console.log + helper function declarations
 * + plain const/let in source order.
 *
 * Returns both the joined code string AND the raw statement array so the
 * caller can generate a single-program source map via GEN_OPTS_MAP.
 */
function emitResidualScriptBody(
  clonedProgram: t.File,
  consumedLifecycleIndices: Set<number>,
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
    // (its `computed(...)` re-emit already carries the cast — see
    // emitComputedDecls above).
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

      // Phase 36 — `const x = $inject('k', f?)` binders are COMPILE-TIME
      // directives consumed via ir.injects and re-emitted by emitContext as
      // `const x = inject('k', f?)`. Strip them from the residual body so the
      // bare `$inject` identifier never leaks as an undefined runtime ref.
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

    // Skip ExpressionStatements that are $emit/$computed/$onMount/$onUnmount/$onUpdate
    // calls at top level — these would only get here if not consumed above (rare/safety).
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
          // Phase 21 — `$expose({...})` is a COMPILE-TIME directive consumed via
          // ir.expose and re-emitted as a `defineExpose({...})` macro (see
          // emitDefineExposeCall). It MUST be stripped from the residual script
          // body — otherwise it leaks as an undefined-`$expose` runtime reference.
          callee.name === '$expose' ||
          // Phase 36 — `$provide('k', v)` is consumed via ir.provides and
          // re-emitted by emitContext as a native `provide('k', v)` call. Strip
          // the directive so the bare `$provide` ref never leaks at runtime.
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

  const code = stmts.map((s) => genCode(s)).join('\n');
  return { code, stmts };
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptOptions {
  /**
   * D-85 Vue full (Plan 06-02 Task 3): when set, emitPropsDecl emits a
   * parameterized interface `${Name}Props<T, ...>` so that the surrounding
   * `<script setup generic="T">` attribute (set by buildShell) can resolve
   * the type parameter through the `defineProps<...>` macro.
   *
   * When omitted (the existing Phase 3 calling pattern), the existing
   * inline type literal is emitted unchanged — byte-identical for the 5
   * non-generic reference examples.
   */
  genericParams?: string[];
  /**
   * Phase 06.1 P2 (D-103): .rozie filename surfaced as `sourceFileName` on
   * @babel/generator's per-call output map. Defaults to '<rozie>' when
   * omitted (mostly back-compat for tests; production callers thread the
   * real filename through).
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

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptResult {
  script: string;
  /**
   * Source map for user-authored statements (residual body), produced by
   * @babel/generator with sourceMaps:true via a single-program generate call.
   * Maps positions in the generated residual text back to the original .rozie
   * source lines. The shell adjusts this map's generated line numbers by
   * userCodeLineOffset so the final map references the correct .vue output
   * line numbers. Null when there are no residual statements or no filename
   * was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Number of lines in all sections assembled BEFORE the residual (user-code)
   * section. Used by buildShell to compute userCodeLineOffset — the total
   * number of output lines before the user-authored statements begin.
   */
  preambleSectionLines: number;
  /**
   * Phase 45-07 (WR-02/WR-06) — true if the script body called `$clone(x)`,
   * which on Vue lowers to `rozieDeepClone(x)`. emitVue consumes this to thread
   * `import { rozieDeepClone } from '@rozie/runtime-vue'` through the runtime-vue
   * ScriptInjection dedupe path (the same path debounce/throttle/useOutsideClick
   * use), so it merges cleanly with any existing runtime-vue import line.
   */
  usesDeepClone: boolean;
  diagnostics: Diagnostic[];
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  const { slotsUsed, usesDeepClone } = rewriteRozieIdentifiers(cloned, ir, diagnostics);

  const imports = new VueImportCollector();

  // 3. Emit blocks in canonical order.
  const propsLine = emitPropsDecl(ir, opts.genericParams);
  const modelLines = emitDefineModels(ir);
  const emitsLine = emitDefineEmitsCall(ir);
  const slotsLine = emitDefineSlotsStub(ir);
  // Phase 07.7 fix — script-level $slots references rewrite to `slots.X`
  // (see rewriteScript.ts MemberExpression branch for `$slots`). When that
  // rewrite fires OR when the component has any portal slot (whose emitted
  // closure also reads from `slots.${name}`), emit `const slots = useSlots();`
  // + import `useSlots`. Surfaced by FullCalendar.rozie's `if ($slots.event)`
  // engine-callback gate (was emitting bare `$slots.event` → ReferenceError
  // at runtime; `event` is itself a portal slot, so the legacy non-portal-only
  // condition skipped the rewrite).
  const hasPortalSlots = ir.slots.some((s) => s.isPortal === true);
  const useSlotsLine: string[] = [];
  if (slotsUsed || hasPortalSlots) {
    imports.use('useSlots');
    useSlotsLine.push('const slots = useSlots();');
  }
  // Phase 45-07 (WR-02/WR-06) — $clone(x) lowers to `rozieDeepClone(x)` on Vue
  // (the recursive proxy-safe deep clone in @rozie/runtime-vue). The import is
  // NOT a `'vue'` symbol, so it is NOT collected here; instead emitVue threads
  // `import { rozieDeepClone } from '@rozie/runtime-vue'` via the runtime-vue
  // ScriptInjection dedupe path using the usesDeepClone flag returned below.
  const dataLines = emitDataRefs(ir, imports);
  const refLines = emitTemplateRefs(ir, imports);

  const { bodies: clonedComputedBodies, casts: clonedComputedCasts } =
    findClonedComputedBodies(cloned);
  const computedLines = emitComputedDecls(
    ir.computed,
    clonedComputedBodies,
    imports,
    clonedComputedCasts,
  );

  const { lines: lifecycleLines, consumedIndices } = emitLifecycleHooks(cloned, imports);

  // Portal-slot primitive (Spike 003) — synthesize setup-level scaffolding
  // when ir.slots has any portal entries. Lines are spliced between residual
  // and lifecycle sections below so the `portals` closure exists before user
  // $onMount callbacks that capture it.
  const portalsEmit = emitPortals(ir, imports, opts.portalScopeHash ?? '');

  // Cross-component context primitive (Phase 36) — emit Vue native
  // `provide('k', v)` / `const x = inject('k', f?)`. Reads value/fallback
  // expressions from the CLONED program so `$data`/`$props`/`$refs` inside a
  // provided value or inject fallback pick up the identifier rewrites above.
  // Empty-gated: contextEmit.hasContext is false (and nothing is spliced) when
  // the component has no $provide/$inject — preserving byte-identity (R12/D-5).
  const contextEmit = emitContext(ir, imports, cloned);

  // Quick plan 260515-u2b — $watch emission. Walks the same cloned program
  // and emits one `watch(getter, cb);` per top-level $watch call. Returns the
  // additional consumed indices so emitResidualScriptBody skips them.
  const { lines: watcherLines, consumedIndices: watcherConsumed } =
    emitWatcherHooks(cloned, imports);
  for (const idx of watcherConsumed) consumedIndices.add(idx);

  // Phase 21 (REQ-4) — `defineExpose({...})` macro. Emitted LAST in the
  // <script setup> body (SPEC Req 4: "after the setup body"), after the user
  // script + defineEmits/defineSlots + lifecycle/refs/watchers, so every
  // referenced function is already in scope. '' when ir.expose is empty.
  const exposeLine = emitDefineExposeCall(ir);

  const { code: residualCode, stmts: residualStmts } = emitResidualScriptBody(cloned, consumedIndices);

  // 4. Assemble in canonical order with blank-line separators between sections.
  const preambleSections: string[] = [];
  const importLine = imports.render();
  if (importLine) preambleSections.push(importLine);
  if (propsLine) preambleSections.push(propsLine);
  if (modelLines.length > 0) preambleSections.push(modelLines.join('\n'));
  if (emitsLine) preambleSections.push(emitsLine);
  if (slotsLine) preambleSections.push(slotsLine);
  if (useSlotsLine.length > 0) preambleSections.push(useSlotsLine.join('\n'));
  if (dataLines.length > 0) preambleSections.push(dataLines.join('\n'));
  if (refLines.length > 0) preambleSections.push(refLines.join('\n'));
  if (computedLines.length > 0) preambleSections.push(computedLines.join('\n'));
  // Phase 36 — inject binders (`const x = inject('k', f?)`) join the preamble
  // AFTER refs/computed and BEFORE the residual body, so user script + the
  // template can reference the injected `const`. Counted into
  // preambleSectionLines automatically (source-map offset stays correct).
  if (contextEmit.injectLines.length > 0) {
    preambleSections.push(contextEmit.injectLines.join('\n'));
  }

  // Count lines in preamble sections so shell can compute userCodeLineOffset.
  // Each section is joined with '\n\n' between sections; count newlines total.
  // When there IS a residual section, `script = preambleText + '\n\n' + residualCode`.
  // The '\n\n' separator contributes 2 newlines:
  //   - 1st '\n' terminates the last preamble line
  //   - 2nd '\n' creates a blank separator line
  // So lines before residual = (newlines_in_preambleText + 1 lines) + 1 blank = N + 2.
  const preambleText = preambleSections.join('\n\n');
  const preambleSectionLines = preambleText.length > 0
    ? (preambleText.match(/\n/g) ?? []).length + 2  // +2: last preamble line + blank separator
    : 0;

  // Residual body BEFORE lifecycle hooks — `onMounted(lockScroll)` references
  // `lockScroll` which is a `const` declared in the residual body. Emitting
  // lifecycle BEFORE residual triggered a JS TDZ crash at component mount
  // time (Modal.rozie repro). Vue's onMounted just registers the callback;
  // it doesn't matter whether it's called before or after a `const` decl as
  // long as the const exists by the time `onMounted`'s argument is evaluated.
  const sections = [...preambleSections];
  if (residualCode.trim().length > 0) sections.push(residualCode);
  // Phase 36 — `provide('k', v)` calls emitted AFTER the residual body so a
  // provided value may reference residual-declared helpers (e.g.
  // `$provide('theme', { get color() {…}, cycle })` where `cycle` is a residual
  // `function`/`const`). The provided value carries the live ref/getter, so
  // descendants read reactive (D-3 / REQ-29). provide() registration order
  // among setup statements is irrelevant — it only must fire during setup.
  if (contextEmit.provideLines.length > 0) {
    sections.push(contextEmit.provideLines.join('\n'));
  }
  // Portal-slot primitive — emit portal scaffolding BEFORE lifecycle so the
  // `portals` closure is in scope when the user's onMounted callback fires.
  if (portalsEmit.hasPortals) sections.push(portalsEmit.setupLines);
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));
  // Quick plan 260515-u2b — emit watch() calls AFTER lifecycle calls so any
  // helpers referenced inside the watch callback (declared in residual body)
  // are in scope. watch() registration order doesn't matter for correctness.
  if (watcherLines.length > 0) sections.push(watcherLines.join('\n'));
  // Phase 21 — append `defineExpose({...})` LAST so the handle is registered
  // after every exposed function is declared in the setup body.
  if (exposeLine) sections.push(exposeLine);

  const script = sections.join('\n\n');

  // Generate a single-program source map for the residual (user-authored) statements.
  // These AST nodes carry correct .rozie line numbers from @babel/parser, so the
  // map produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the final
  // map references the correct .vue output line numbers.
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

  return { script, scriptMap, preambleSectionLines, usesDeepClone, diagnostics };
}

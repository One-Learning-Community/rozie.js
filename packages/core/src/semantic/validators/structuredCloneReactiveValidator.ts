/**
 * Phase 45 (D-02) — `structuredClone(<reactive binding>)` → `$clone` advisory
 * validator (ROZ135).
 *
 * `structuredClone(x)` THROWS ("could not be cloned" / DataCloneError) when `x`
 * is a framework reactivity proxy — a Vue `reactive()` object or a Svelte
 * `$state` object. This is a SILENT, target-asymmetric footgun: the same author
 * source works on React / Solid / Lit / Angular (plain values, no proxy) but
 * throws on Vue and Svelte ONLY, silently leaving snapshot/history state empty
 * (surfaced by the Phase 44 rete undo stack). The new `$clone(x)` sigil deep-
 * clones AND strips the proxy on all six targets, so this validator steers
 * authors off the raw `structuredClone(<reactive>)` pattern and onto `$clone`.
 *
 * ── FLAGGED ──────────────────────────────────────────────────────────────────
 *   A `CallExpression` where:
 *     - callee is `Identifier('structuredClone')`, AND
 *     - arguments[0] is a (Optional)MemberExpression whose ROOT object
 *       identifier ∈ { $props, $data, $model }.
 *   Examples: structuredClone($data.graph), structuredClone($props.x.y),
 *             structuredClone($model.z).
 *   OR a `CallExpression structuredClone(<id>)` where `<id>` is a ONE-HOP
 *     `const` alias — a same-scope `const <id> = <member rooted at a reactive
 *     accessor>` declaration (WR-03). Example: `const g = $data.graph;
 *     structuredClone(g)`. Aliases collected per <script>; const-only,
 *     single-declaration, initializer-is-directly-a-reactive-member.
 *   Walked in <script> and <template> expression positions (binding,
 *   interpolation, r-if/r-show/r-text/r-html, r-for iterable). Note: the alias
 *   map is built from <script> declarations only — a `structuredClone(g)` in a
 *   template references a <script>-scoped const, so template calls consult the
 *   same map.
 *
 * ── DO-NOT-FLAG ──────────────────────────────────────────────────────────────
 *   - structuredClone(someKnownPlainLocal) — argument is not a member rooted at
 *     a reactive accessor (D-02 conservative syntactic match → zero false
 *     positives; a legitimate clone of a plain local still compiles clean).
 *   - <listeners> handler bodies — intentionally NOT walked (mirrors
 *     refsPreMountValidator; A2 conservative default).
 *   - Aliased reactive bindings BEYOND one hop. We DO flag a one-hop `const`
 *     alias whose initializer is DIRECTLY a reactive member
 *     (`const g = $data.graph; structuredClone(g)` → flag), but NOT:
 *       · transitive chains  `const a = $data.x; const b = a; clone(b)`
 *       · `let`/reassigned/multiply-declared aliases (initializer may go stale)
 *       · function parameters `commitGraph(g)` or call returns `currentGraph()`
 *     Those need flow / interprocedural analysis and risk false positives —
 *     out of scope (WR-03: one-hop const alias only; D-02 zero-false-positive).
 *
 * Severity is `warning` (NOT error) — a legitimate `structuredClone(plainLocal)`
 * must still compile. Mirrors the ROZ123/127/128 target-asymmetry guard pattern.
 * Auto-rewrite is explicitly rejected (D-02 — warn, never silently rewrite).
 *
 * ── Re-parse / byte-offset discipline ────────────────────────────────────────
 * Template expression text is re-parsed via @babel/parser.parseExpression inside
 * a try/catch (D-08: never throws — the parser layer already diagnosed malformed
 * mustache/expression text). Every emitted diagnostic carries an absolute
 * byte-offset loc: re-parsed fragments add the fragment's base offset (the
 * attribute valueLoc.start, the interpolation loc.start + 2 to skip `{{`, or the
 * r-for value offset + the iterable's position within the LHS string).
 * `<script>` nodes carry absolute .rozie offsets (baseOffset 0).
 *
 * This validator has NO bindings dependency.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { parseExpression } from '@babel/parser';
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';

// Default-export interop: see refsPreMountValidator.ts for the same pattern.
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? _traverse
    : (_traverse as unknown as { default: TraverseFn }).default;

/** The reactive accessor roots whose deep clone via raw `structuredClone`
 *  throws on Vue/Svelte proxies. Syntactic match only (D-02). */
const REACTIVE_ROOTS = new Set(['$props', '$data', '$model']);

/**
 * A collected one-hop reactive alias: a same-scope `const <name> = <member
 * rooted at $props/$data/$model>` declaration (WR-03). `rootName` is the
 * reactive accessor root; `memberNode` is the initializer member expression
 * (reused to render the precise dotted path via `memberPath`, IN-03).
 */
interface ReactiveAlias {
  rootName: string;
  memberNode: t.MemberExpression | t.OptionalMemberExpression;
}

interface ValidatorContext {
  diagnostics: Diagnostic[];
  /**
   * One-hop reactive `const` aliases collected from the `<script>` pre-pass,
   * keyed by alias identifier name. A name maps to `null` (a disqualifier
   * tombstone) when it is multiply-declared, declared with `let`/`var`, or
   * otherwise assigned — so a later `structuredClone(<name>)` is NOT flagged
   * (conservative: ambiguous → do not flag, zero false positives).
   */
  reactiveAliases: Map<string, ReactiveAlias | null>;
}

/**
 * Shift Babel-relative offsets (computed against the parsed expression
 * fragment) into absolute offsets in the .rozie file by adding `baseOffset`.
 */
function locFromNodeOffset(node: t.Node, baseOffset: number): SourceLoc {
  return {
    start: (node.start ?? 0) + baseOffset,
    end: (node.end ?? 0) + baseOffset,
  };
}

/**
 * Unwind a (Optional)MemberExpression `.object` chain to the root identifier
 * name. `$data.graph.nodes` → `$data`; `$props?.x.y` → `$props`. Returns null if
 * the root is not a plain identifier (e.g., a call or computed expression).
 */
function memberRoot(node: t.Node): string | null {
  let cur: t.Node = node;
  while (t.isMemberExpression(cur) || t.isOptionalMemberExpression(cur)) {
    cur = (cur as t.MemberExpression | t.OptionalMemberExpression).object;
  }
  return t.isIdentifier(cur) ? cur.name : null;
}

/**
 * Render the resolved member path of a `(Optional)MemberExpression` rooted at a
 * reactive accessor — `$data.graph` → `'$data.graph'`, `$props.x.y` →
 * `'$props.x.y'`. Returns null (caller falls back to the `<root>.…` form) when
 * the chain contains a computed access (`$data[k]`), a call, or any non-plain-
 * identifier property — i.e. whenever a precise dotted path can't be rendered
 * (IN-03 — defensive; the validator NEVER throws, D-08).
 */
function memberPath(node: t.Node, rootName: string): string | null {
  const segments: string[] = [];
  let cur: t.Node = node;
  while (t.isMemberExpression(cur) || t.isOptionalMemberExpression(cur)) {
    const m = cur as t.MemberExpression | t.OptionalMemberExpression;
    // Computed (`$data[k]`) or non-identifier property — can't render a precise
    // dotted path; bail to the fallback form.
    if (m.computed || !t.isIdentifier(m.property)) return null;
    segments.unshift(m.property.name);
    cur = m.object;
  }
  // The chain must bottom out at the reactive root identifier itself.
  if (!t.isIdentifier(cur) || cur.name !== rootName) return null;
  return [rootName, ...segments].join('.');
}

/**
 * Emit ROZ135 (warning) for a `structuredClone(<reactive>)` call at `loc`.
 *
 * IN-03 — when the full dotted member path resolves (`$data.graph`), name it in
 * the message; otherwise fall back to the bare `<root>.…` form. Defensive: a
 * missing/odd-shaped path yields the fallback, never a throw (D-08).
 */
function pushStructuredCloneReactive(
  ctx: ValidatorContext,
  rootName: string,
  argNode: t.Node,
  loc: SourceLoc,
): void {
  const path = memberPath(argNode, rootName);
  const rendered = path ?? `${rootName}.…`;
  ctx.diagnostics.push({
    code: RozieErrorCode.STRUCTURED_CLONE_REACTIVE,
    severity: 'warning',
    message: `structuredClone(${rendered}) throws on Vue reactive()/Svelte $state proxies — use $clone(…) instead.`,
    loc,
    hint: '$clone(x) deep-clones and strips the reactive proxy on all six targets: structuredClone(toRaw(x)) on Vue, $state.snapshot(x) on Svelte, structuredClone(x) elsewhere.',
  });
}

/**
 * If `node` is a (Optional)MemberExpression rooted at a reactive accessor
 * ($props/$data/$model), return `{ rootName, memberNode }`; else null. Shared
 * root-detection predicate so the direct-member case and the one-hop alias case
 * agree on what "rooted at a reactive accessor" means (single source of truth).
 */
function asReactiveMember(node: t.Node): ReactiveAlias | null {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) {
    return null;
  }
  const rootName = memberRoot(node);
  if (rootName === null || !REACTIVE_ROOTS.has(rootName)) return null;
  return { rootName, memberNode: node };
}

/**
 * Pre-pass over a `<script>` program: collect ONE-HOP reactive `const` aliases
 * into `ctx.reactiveAliases` (WR-03). A `const <id> = <reactive member>`
 * declaration registers `<id> → { rootName, memberNode }`. Conservative
 * disqualifiers tombstone the name (`→ null`) so a later `structuredClone(<id>)`
 * is NOT flagged:
 *   - `let`/`var` bindings (the alias may be reassigned to a non-reactive value)
 *   - any name declared more than once (ambiguous which init is live)
 *   - any name that is ASSIGNED elsewhere (`g = other`) — alias goes stale
 * Once tombstoned, a name stays tombstoned (ambiguous beats a false positive).
 *
 * Out of scope (NOT collected — documented; would need flow analysis): two-hop
 * chains (`const b = a`), function params, call-return aliases. These leave the
 * name absent from the map → not flagged.
 *
 * NEVER throws (D-08): @babel/traverse runs a scope-binding pass that itself can
 * throw on malformed input (e.g. a duplicate `const`/`let` declaration the
 * parser-layer diagnostics already own), so the whole walk is wrapped in a
 * try/catch — a partially-built alias map is fine (we only ever ADD live
 * aliases; an aborted walk just yields fewer, never false, flags).
 */
function collectReactiveAliases(
  program: t.Node,
  ctx: ValidatorContext,
): void {
  const aliases = ctx.reactiveAliases;
  // Mark a name as disqualified: once null, it can never become an alias.
  const tombstone = (name: string): void => {
    aliases.set(name, null);
  };

  try {
    traverse(program, {
      VariableDeclarator(path) {
        const id = path.node.id;
        if (!t.isIdentifier(id)) return; // destructuring etc. — not a one-hop alias.
        const name = id.name;
        // Already disqualified — leave the tombstone.
        if (aliases.has(name) && aliases.get(name) === null) return;
        // A second declaration of the same name → ambiguous → disqualify.
        if (aliases.has(name)) {
          tombstone(name);
          return;
        }
        const decl = path.parentPath;
        const isConst =
          decl.isVariableDeclaration() && decl.node.kind === 'const';
        const init = path.node.init;
        const reactive = init ? asReactiveMember(init) : null;
        // `const <id> = <reactive member>` → collect. Anything else
        // (`let`/`var`, non-reactive init, no init) → tombstone the name so a
        // later same-name re-declare can't promote it, and a `structuredClone`
        // of it is never flagged.
        if (isConst && reactive) {
          aliases.set(name, reactive);
        } else {
          tombstone(name);
        }
      },
      AssignmentExpression(path) {
        // A bare `g = …` reassignment makes any same-named alias stale →
        // disqualify (covers the `let g = $data.graph; g = other` case).
        const left = path.node.left;
        if (t.isIdentifier(left)) tombstone(left.name);
      },
    });
  } catch {
    // @babel/traverse scope-binding can throw on malformed input (duplicate
    // declarations etc.); the parser layer already diagnosed it. Keep whatever
    // aliases were collected before the throw — never propagate (D-08).
  }
}

/**
 * Emit ROZ135 (warning) for a one-hop aliased `structuredClone(<alias>)` call
 * (WR-03), naming BOTH the alias identifier and the reactive member it points
 * at (`structuredClone(g) where g = $data.graph …`). Reuses `memberPath`
 * (IN-03) for the precise dotted member; defensive fallback, never throws (D-08).
 */
function pushStructuredCloneReactiveAlias(
  ctx: ValidatorContext,
  aliasName: string,
  alias: ReactiveAlias,
  loc: SourceLoc,
): void {
  const path = memberPath(alias.memberNode, alias.rootName);
  const rendered = path ?? `${alias.rootName}.…`;
  ctx.diagnostics.push({
    code: RozieErrorCode.STRUCTURED_CLONE_REACTIVE,
    severity: 'warning',
    message: `structuredClone(${aliasName}) where ${aliasName} = ${rendered} throws on Vue reactive()/Svelte $state proxies — use $clone(…) instead.`,
    loc,
    hint: '$clone(x) deep-clones and strips the reactive proxy on all six targets: structuredClone(toRaw(x)) on Vue, $state.snapshot(x) on Svelte, structuredClone(x) elsewhere.',
  });
}

/**
 * Visit a parsed expression subtree, flagging every
 * `structuredClone(<member rooted at a reactive accessor>)` call AND every
 * one-hop `structuredClone(<reactive const alias>)` call (WR-03). At most ONE
 * diagnostic per call; direct-member detection takes precedence.
 */
function flagStructuredCloneInTree(
  root: t.Node,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  // @babel/traverse's scope-binding pass can throw on malformed input (e.g. a
  // duplicate `const`/`let` in <script>); the parser layer already diagnosed
  // it. Wrap so the validator never propagates (D-08).
  try {
    traverse(root, {
      CallExpression(path) {
        const callee = path.node.callee;
        if (!t.isIdentifier(callee) || callee.name !== 'structuredClone') {
          return;
        }
        const args = path.node.arguments;
        if (args.length < 1) return;
        const arg = args[0]!;
        // Direct-member case — `structuredClone($data.graph)`. Takes precedence.
        const direct = asReactiveMember(arg);
        if (direct !== null) {
          pushStructuredCloneReactive(
            ctx,
            direct.rootName,
            direct.memberNode,
            locFromNodeOffset(path.node, baseOffset),
          );
          return;
        }
        // One-hop alias case — `structuredClone(g)` where `const g = $data.graph`.
        if (t.isIdentifier(arg)) {
          const alias = ctx.reactiveAliases.get(arg.name);
          // `undefined` = never declared as a tracked alias; `null` = tombstoned
          // disqualifier (let/reassigned/multiply-declared). Only a live alias
          // record fires.
          if (alias) {
            pushStructuredCloneReactiveAlias(
              ctx,
              arg.name,
              alias,
              locFromNodeOffset(path.node, baseOffset),
            );
          }
        }
      },
    });
  } catch {
    // Swallow — parser-layer diagnostics own malformed input (D-08).
  }
}

// ── <script> walk ────────────────────────────────────────────────────────────

function validateScript(script: ScriptAST, ctx: ValidatorContext): void {
  // <script> nodes carry absolute .rozie offsets — baseOffset 0.
  flagStructuredCloneInTree(script.program, 0, ctx);
}

/**
 * Build the one-hop reactive-alias map from the `<script>` program (WR-03).
 * Run BEFORE both the script and template flag walks so a `structuredClone(g)`
 * in either position resolves the same `<script>`-scoped `const g = $data.…`.
 */
function collectScriptAliases(
  script: ScriptAST,
  ctx: ValidatorContext,
): void {
  collectReactiveAliases(script.program, ctx);
}

// ── <template> walk ──────────────────────────────────────────────────────────

/**
 * Re-parse a template-expression fragment and flag reactive structuredClone
 * calls. Returns silently on parse failure (parser layer already diagnosed it).
 * NEVER throws (D-08).
 */
function parseAndFlag(
  text: string,
  baseOffset: number,
  ctx: ValidatorContext,
): void {
  let expr: t.Expression;
  try {
    expr = parseExpression(text, { sourceType: 'module' });
  } catch {
    return; // malformed — parser-layer diagnostics cover it; stay silent (D-08).
  }
  const wrapped = t.file(t.program([t.expressionStatement(expr)]));
  flagStructuredCloneInTree(wrapped, baseOffset, ctx);
}

// `(item, idx) in iterable` / `item of iterable` — find the keyword split so we
// can re-parse ONLY the iterable RHS and skip the alias LHS (not a JS
// expression). Mirrors refsPreMountValidator's posture.
const R_FOR_KEYWORD = /\s+(?:in|of)\s+/;

function validateRForIterable(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  const m = R_FOR_KEYWORD.exec(attr.value);
  if (!m || m.index === undefined) return; // malformed r-for — rForKeyValidator owns it.
  const iterableStart = m.index + m[0].length;
  const iterable = attr.value.slice(iterableStart);
  parseAndFlag(iterable, attr.valueLoc.start + iterableStart, ctx);
}

/**
 * Walk a TemplateAttr's expression value. SKIP `static`. FLAG `binding`,
 * `event`, `r-model`, and the directive expression positions — `structuredClone`
 * of a reactive binding throws regardless of WHERE it is evaluated (unlike the
 * pre-mount $refs concern, the proxy-throw is position-independent), so this
 * validator flags every expression-bearing attribute value.
 */
function validateTemplateAttr(attr: TemplateAttr, ctx: ValidatorContext): void {
  if (attr.value === null || attr.valueLoc === null) return;
  if (attr.kind === 'static') return; // not a JS expression.
  if (attr.kind === 'directive' && attr.name === 'for') {
    validateRForIterable(attr, ctx);
    return;
  }
  parseAndFlag(attr.value, attr.valueLoc.start, ctx);
}

function isElement(node: TemplateNode): node is TemplateElement {
  return node.type === 'TemplateElement';
}

function isInterpolation(
  node: TemplateNode,
): node is { type: 'TemplateInterpolation'; rawExpr: string; loc: SourceLoc } {
  return node.type === 'TemplateInterpolation';
}

function visitTemplateNode(node: TemplateNode, ctx: ValidatorContext): void {
  if (isInterpolation(node)) {
    // {{ ... }} — baseOffset = loc.start + 2 (skipping `{{`).
    parseAndFlag(node.rawExpr, node.loc.start + 2, ctx);
    return;
  }
  if (!isElement(node)) return;
  for (const attr of node.attributes) {
    validateTemplateAttr(attr, ctx);
  }
  for (const child of node.children) {
    visitTemplateNode(child, ctx);
  }
}

function validateTemplate(template: TemplateAST, ctx: ValidatorContext): void {
  for (const child of template.children) {
    visitTemplateNode(child, ctx);
  }
}

/**
 * Run the `structuredClone(<reactive binding>)` → `$clone` validator over the
 * given AST. Emits ROZ135 (warning) into `diagnostics`. NEVER throws (D-08). No
 * bindings dependency.
 *
 * Note: <listeners> is intentionally NOT walked (A2 conservative default,
 * mirroring refsPreMountValidator).
 */
export function runStructuredCloneReactiveValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  const ctx: ValidatorContext = {
    diagnostics,
    reactiveAliases: new Map<string, ReactiveAlias | null>(),
  };
  // Pre-pass: collect one-hop reactive const aliases from <script> first, so
  // both the script and template flag walks can resolve `structuredClone(g)`
  // against the same alias map (WR-03).
  if (ast.script) collectScriptAliases(ast.script, ctx);
  if (ast.script) validateScript(ast.script, ctx);
  if (ast.template) validateTemplate(ast.template, ctx);
}

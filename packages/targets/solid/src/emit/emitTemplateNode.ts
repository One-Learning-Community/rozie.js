/**
 * emitTemplateNode — Solid target (P2 complete implementation).
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * JSX-string fragments per the Solid emission patterns:
 *
 *   - r-if / r-else-if / r-else → <Show when={...} fallback={...}>
 *   - r-for → <For each={items()}>{(item, index) => ...}</For>
 *   - Signal reads → name() (MUST use getter call form — Solid reactivity)
 *   - ref="foo" → ref={(el) => { fooRef = el; }}
 *   - class= → kept as class= (Solid supports class; does NOT need className)
 *   - Events → onClick={...} (camelCase)
 *   - Slot invocations → per D-133 patterns
 *   - tagKind: 'component' / 'self' → PascalCase tag verbatim
 *
 * Component-scope attribute injection (paired with `emitStyle`'s `scopeCss`):
 *   When `ctx.scopeAttr` is set, every emitted HTML host element (i.e.
 *   `tagKind === 'html'`) gets a bare attribute (e.g. `data-rozie-s-abc123`).
 *   This matches the attribute appended to every selector by `scopeCss`, so
 *   the component's CSS rules apply only to elements it actually renders —
 *   mirroring Vue's `<style scoped>` data-v-* semantics. Component tags
 *   (`tagKind === 'component'` / `'self'`) intentionally DO NOT get the
 *   attribute: child components carry their own scope.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  TemplateSlotInvocationIR,
  AttributeBinding,
  IRComponent,
  Listener,
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import {
  emitAttributes,
  emitListenerSpread,
  emitListenerSpreadAsMergePartial,
} from './emitTemplateAttribute.js';
import { emitConditional } from './emitConditional.js';
import { emitTemplateEvent, domEventType, solidEventParamType } from './emitTemplateEvent.js';
import { emitRModel } from './emitRModel.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
// Phase 07.2 Plan 03 — consumer-side slot-fill emission for component-tag elements.
import { emitSlotFiller, emitDynamicSlotsProp } from './emitSlotFiller.js';
// Phase 71 (r-keynav) — REFERENCE emitter wiring modeled on the React target
// (see emitKeynav.ts's module doc comment).
import {
  keynavItemAttrs,
  keynavRootAttrs,
  loopBodyHasKeynavItem,
  stripKeynavCommitEvent,
  type KeynavEmitPlan,
} from './emitKeynav.js';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector };
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Top-of-component-body lines (e.g., debounce/throttle wrapper consts) */
  scriptInjections: string[];
  /** Per-component counter for stable wrap-name suffixes */
  injectionCounter: { next: number };
  /**
   * Component-scope attribute name (e.g. `data-rozie-s-abc12345`) to inject on
   * every emitted HTML host element. Paired with `emitStyle`'s `scopeCss`
   * selector rewriter so this component's CSS rules apply only to elements
   * it actually renders. Empty string (or undefined) disables injection —
   * back-compat for callers that don't thread a scope hash.
   */
  scopeAttr?: string;
  /**
   * Identifiers in the current lexical scope that resolve to Solid Accessors
   * (`() => T`) rather than scalar values. emitLoop populates this with the
   * loop's `indexAlias` so `rewriteTemplateExpression` calls inside the loop
   * body auto-invoke bare references — `keyFor(item, index)` becomes
   * `keyFor(item, index())`. Without this, `eslint-plugin-solid` flags the
   * usage and the value passed to user code is the accessor function itself.
   */
  invokeAccessors?: ReadonlySet<string> | undefined;
  /**
   * Spike-012 NEW-4 — identifiers bound to a RAW loop value by an enclosing
   * keyless `<For>` (the item alias). Threaded into every `rewriteTemplateExpression`
   * call in a loop body so a bare loop var stays bare even when it shadows a
   * `$computed` (which would otherwise be rewritten to `name()` — calling the
   * scalar). Keyed `<Key>` item aliases are real accessors and go via
   * `invokeAccessors` instead. Undefined outside any loop (back-compat no-op).
   */
  loopValueBindings?: ReadonlySet<string> | undefined;
  /**
   * Phase 33 / REQ-26 — reactive-portal scope-accessor rewrite, threaded onto
   * the child ctx used to render a reactive portal slot fill body (see
   * emitSlotFiller). Maps each consumer scope-param local name to the scope
   * property it resolves to; bare reads are rewritten to `<accessor>().<prop>`
   * so the fragment re-renders in place on `setScopeSig`. Undefined everywhere
   * except inside a reactive portal fill body (back-compat).
   */
  scopeAccessorParams?:
    | { accessorIdent: string; params: ReadonlyMap<string, string> }
    | undefined;
  /**
   * Phase 71 (r-keynav) — the per-component keynav emission plan (resolved
   * ONCE by `emitTemplate.ts` via `resolveKeynavPlan`), or `null` when the
   * component has no `r-keynav` root. `undefined` (the default, back-compat
   * for any caller that doesn't thread this field) behaves identically to
   * `null` at every read site (`ctx.keynav ?? null`).
   */
  keynav?: KeynavEmitPlan | null;
  /**
   * Phase 71 (r-keynav) — the CURRENT `r-for` loop's index-alias identifier
   * (author-declared OR compiler-synthesized), threaded from `emitLoop` so a
   * `keynavItem` element deep in the loop body can build its
   * `data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabIndex` bindings.
   * `null` when the current element isn't (transitively) inside a loop, or
   * the enclosing loop has no keynav item and needed no index. This is a
   * Solid `<For>` Accessor identifier (`() => number`) — `keynavItemAttrs`
   * appends `()` at each use site.
   */
  keynavItemIndexAlias?: string | null;
  /**
   * Quick task 260704-mf3 — shared mutable flag threaded from `emitTemplate`
   * (created there beside `scriptInjections`/`injectionCounter`, mutated by
   * descendant `emitLoop` calls). A keyed `r-for` (`node.keyExpression !==
   * null`) sets `needed = true`, which `emitSolid.ts` reads back through
   * `EmitTemplateResult.needsKeyedImport` to inject
   * `import { Key } from '@solid-primitives/keyed';`. An OBJECT (not a bare
   * boolean) because child ctxs are spread-copied — the object reference is
   * shared, a primitive would not propagate up. Optional/back-compat: any
   * caller that doesn't thread it emits keyless loops only (the `<Key>` branch
   * guards on `ctx.keyedImport`).
   */
  keyedImport?: { needed: boolean };
}

function emitStaticText(node: TemplateStaticTextIR, _ctx: EmitNodeCtx): string {
  return node.text;
}

function emitInterpolation(node: TemplateInterpolationIR, ctx: EmitNodeCtx): string {
  const code = rewriteTemplateExpression(node.expression, ctx.ir, {
    invokeAccessors: ctx.invokeAccessors,
    loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
  });
  // Phase 26 (D-06/D-07/A4) — the wrap sits INSIDE the JSX `{}` so Solid still
  // tracks the reactive accessor read (the accessor invocation lives in `code`).
  // Non-primitive values render portable JSON; raw when provably primitive or
  // safeInterpolation is off (SPEC-3, byte-identical to pre-phase).
  if (node.wrapForDisplay) {
    ctx.collectors.runtime.add('rozieDisplay');
    return `{rozieDisplay(${code})}`;
  }
  return `{${code}}`;
}

function emitFragment(node: TemplateFragmentIR, ctx: EmitNodeCtx): string {
  if (node.children.length === 1) return emitNode(node.children[0]!, ctx);
  const parts = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<>${parts}</>`;
}

/**
 * Quick task 260704-mf3 — true when `expr`'s AST contains an `Identifier`
 * named `name` (a free reference, e.g. the loop index alias inside a `:key`
 * expression). Duck-typed walk mirroring `tempNameIsReferenced` — no
 * @babel/types import needed; the IR `Expression` nodes carry `type`/`name`.
 */
function expressionReferencesIdentifier(expr: unknown, name: string): boolean {
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk);
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (obj['type'] === 'Identifier' && obj['name'] === name) return true;
    return Object.values(obj).some(walk);
  };
  return walk(expr);
}

/**
 * Emit a TemplateLoop.
 *
 * KEYLESS (`node.keyExpression === null`) — `<For each={items()}>{(item,
 * index) => ...}</For>`. Solid's <For> reconciles by referential identity;
 * under <For> the item alias is a RAW value (never an accessor).
 *
 * KEYED (`node.keyExpression !== null`) — quick task 260704-mf3. The author
 * wrote `:key="expr"`, so honor it via `@solid-primitives/keyed`'s `<Key>`:
 * `<Key each={items()} by={(item) => <keyExpr>}>{(item, index) => ...}</Key>`.
 * <Key> reconciles by the `by` key (NOT array-item reference), preserving
 * composed-child state (e.g. an open Popover menu) when the iterable returns
 * fresh wrapper objects with stable keys (table-core's `getHeaderGroups()`).
 * Under <Key> BOTH the item and index callback params are Solid Accessors, so
 * every body reference to either is routed through `invokeAccessors` to get
 * `()` appended (`item().label`, `i()`). The `by` key function's param is the
 * item accessor too, so the key expr is rewritten with the item alias in
 * `invokeAccessors` (`item().id`).
 *
 * Angular (`track`), Svelte (`{#each ...(key)}`), and Lit already honor
 * `keyExpression`; this closes the Solid gap. Keyless output is byte-identical
 * to HEAD (the keyed branch is fully separate).
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  // Quick task 260704-mf3 — `<Key>` reconciles by a `by={(item) => key}`
  // function whose ONLY parameter is the item accessor; Solid's `<Key>` does
  // NOT pass the index into `by`. So an author who keyed by the loop's index
  // alias (`:key="index"`) cannot be honored via `<Key>` — the key expression
  // would reference an out-of-scope identifier. Keying by index also defeats
  // the purpose of `<Key>` (stable-id reconciliation), so we fall back to the
  // byte-identical `<For>` path (status quo: the index-key was already dropped
  // for Solid) rather than emit broken output. Only the AUTHOR index alias is
  // checked — a synthesized keynav index never appears in an author `:key`.
  const keyDependsOnIndex =
    node.keyExpression !== null &&
    node.indexAlias !== null &&
    expressionReferencesIdentifier(node.keyExpression, node.indexAlias);
  const keyed = node.keyExpression !== null && !keyDependsOnIndex;

  if (!keyed) {
    ctx.collectors.solid.add('For');
  } else if (ctx.keyedImport) {
    // Signal emitSolid to inject `import { Key } from '@solid-primitives/keyed'`.
    // `Key` is NOT a solid-js export, so it does NOT go through
    // `collectors.solid.add` (the SolidImportCollector allowlists solid-js
    // names only) — it flows via this shared-object flag + a bespoke shell part.
    ctx.keyedImport.needed = true;
  }

  // The iterable expression is OUTSIDE the CURRENT loop's scope (the current
  // item alias is not yet bound), so it never invokes THIS loop's own item.
  // But it DOES live inside any PARENT loop's body scope — and under a keyed
  // parent (`<Key>`, 260704-mf3) the parent's item alias is an Accessor. A
  // nested loop whose iterable reads the outer item (`each={group.members}`)
  // must therefore invoke it: `each={group().members}`. Threading the parent
  // scope's `ctx.invokeAccessors` (which excludes the current item — that is
  // only added to `childCtx` below) does exactly this, and is a no-op for a
  // top-level loop or a keyless parent (the outer item isn't an accessor
  // there), so keyless output stays byte-identical.
  const iterableCode = rewriteTemplateExpression(node.iterableExpression, ctx.ir, {
    invokeAccessors: ctx.invokeAccessors,
    loopValueBindings: ctx.loopValueBindings,    scopeAccessorParams: ctx.scopeAccessorParams,
  });

  // Phase 71 (r-keynav) — SPEC §5: "item index comes from the r-for
  // context". An author who wrote a bare `r-for="it in items"` (no `(it,
  // idx)` index alias) still needs a working `data-rozie-keynav-item={i()}`
  // marker — the compiler synthesizes the index binding itself (SPEC §1's
  // "the primitive reads as markup ... the compiler owns the rest") rather
  // than requiring the author to declare an index alias just for keynav's
  // sake. `loopBodyHasKeynavItem` deliberately does not recurse into a
  // NESTED r-for, so this synthesis never fires for an unrelated outer loop.
  // Preserved identically under the <Key> branch — <Key> passes the index as
  // an accessor too, exactly like <For>.
  const needsKeynavIndex =
    (ctx.keynav ?? null) !== null &&
    node.indexAlias === null &&
    loopBodyHasKeynavItem(node.body);
  const indexAlias = node.indexAlias ?? (needsKeynavIndex ? '__rozieKeynavIndex' : null);

  // Build the callback arrow signature: (item) or (item, index)
  const aliasStr = indexAlias
    ? `(${node.itemAlias}, ${indexAlias})`
    : `(${node.itemAlias})`;

  // Inside the loop body, indexAlias is bound to a Solid Accessor<number>
  // (NOT a number). Threading it via `invokeAccessors` on a child ctx makes
  // descendant rewriteTemplateExpression calls auto-wrap bare references in
  // CallExpressions — see EmitNodeCtx.invokeAccessors for rationale.
  // `keynavItemIndexAlias` is scoped to THIS loop's body subtree only — a
  // nested loop's own `emitLoop` call overwrites it for its own children.
  //
  // KEYED (<Key>): the ITEM alias is ALSO an accessor, so it joins
  // `invokeAccessors` too (every body ref to the loop var gets `()`). The
  // spread `...(ctx.invokeAccessors ?? [])` carries an outer loop's item
  // accessor down into a nested loop body, so `outerItem()` stays correct at
  // inner depth.
  const bodyAccessors = new Set([
    ...(ctx.invokeAccessors ?? []),
    ...(keyed ? [node.itemAlias] : []),
    ...(indexAlias ? [indexAlias] : []),
  ]);
  // Spike-012 NEW-4 — under a keyless `<For>` the item alias is a RAW value, so
  // it must be excluded from the computed/accessor rewrite in the body (a bare
  // `item` stays `item`, never `item()`, even when it shadows a `$computed`).
  // A keyed `<Key>` item alias is a real accessor and lives in `bodyAccessors`
  // above, NOT here. Parent raw-loop bindings accumulate so a nested keyless
  // loop keeps its outer shadow correct.
  const bodyLoopValueBindings = new Set([
    ...(ctx.loopValueBindings ?? []),
    ...(keyed ? [] : [node.itemAlias]),
  ]);
  const childCtx: EmitNodeCtx =
    keyed || indexAlias
      ? {
          ...ctx,
          invokeAccessors: bodyAccessors,
          loopValueBindings: bodyLoopValueBindings,
          keynavItemIndexAlias: indexAlias,
        }
      : {
          ...ctx,
          loopValueBindings: bodyLoopValueBindings,
          keynavItemIndexAlias: null,
        };

  let bodyJsx: string;
  if (node.body.length === 1) {
    bodyJsx = emitNode(node.body[0]!, childCtx);
  } else {
    const parts = node.body.map((c) => emitNode(c, childCtx)).join('');
    bodyJsx = `<>${parts}</>`;
  }

  if (!keyed) {
    return `<For each={${iterableCode}}>{${aliasStr} => ${bodyJsx}}</For>`;
  }

  // Keyed: `@solid-primitives/keyed`'s `<Key by={(v) => key}>` receives the
  // RAW item value `T` (NOT an Accessor) — only the CHILDREN callback yields
  // accessors. So the key expression rewrites the current item alias as a RAW
  // reference (`item.id`, no `()`), which is why `node.itemAlias` is NOT added
  // to `invokeAccessors` here. A PARENT loop's item alias, however, IS an
  // accessor in this scope, so `ctx.invokeAccessors` (parent scope, excludes
  // the current item) is threaded so a nested key expr that reads the outer
  // item invokes it correctly. The iterable stays outside loop scope.
  const keyCode = rewriteTemplateExpression(node.keyExpression!, ctx.ir, {
    invokeAccessors: ctx.invokeAccessors,
    // Spike-012 R3-2 — the keyed `by` param is a RAW item (not an accessor), so
    // it too must be excluded from the computed rewrite when it shadows a
    // `$computed` (else `by={(item) => item().id}` CALLS the raw item). NEW-4
    // threaded only the KEYLESS body; the keyed `by` needs the current alias
    // added on top of the inherited (parent) raw-loop bindings.
    loopValueBindings: new Set([...(ctx.loopValueBindings ?? []), node.itemAlias]),
  });
  // `<Key>`'s `each?: readonly T[]` infers `T = unknown` from a bare `any`
  // iterable (e.g. a `Record<string, any>` member access), which then poisons
  // the item accessor (`x` is `unknown` → TS18046 in the body). Solid's `<For>`
  // (`each: T extends readonly any[]`) tolerated bare `any` implicitly; restore
  // that by casting the iterable to `readonly any[]` so `<Key>` always infers a
  // usable element type. Type-only (erased at runtime) — reactivity unchanged.
  return `<Key each={${iterableCode} as readonly any[]} by={(${node.itemAlias}) => ${keyCode}}>{${aliasStr} => ${bodyJsx}}</Key>`;
}

/**
 * Find an attribute by name.
 */
function findAttribute(attrs: AttributeBinding[], name: string): AttributeBinding | null {
  for (const a of attrs) {
    // Phase 14 — `spreadBinding` is the name-less kind; it never matches a
    // by-name lookup.
    if (a.kind === 'spreadBinding') continue;
    if (a.name === name) return a;
  }
  return null;
}

/**
 * Build the bare component-scope attribute JSX fragment (e.g.
 * `data-rozie-s-abc12345=""`). Returns `null` only when the context has no
 * scope attr. Applies to both host elements AND child-component invocations
 * (Phase 14.1 cross-target scope propagation): the child's auto-fallthrough
 * spread (or manual `r-bind="$attrs"`) carries the consumer's scope attr onto
 * the child's root element, so the consumer's scoped CSS rules
 * (`.foo[data-rozie-s-CONSUMER]`) match elements styled via consumer-passed
 * `class=` on a child-component invocation. Mirrors Vue's `__scopeId`
 * runtime propagation, baked into the consumer-side emit.
 */
function scopeAttrForElement(node: TemplateElementIR, ctx: EmitNodeCtx): string | null {
  if (!ctx.scopeAttr) return null;
  void node.tagKind;
  // Empty-string attribute value is the canonical "boolean attribute"
  // selector-friendly form. CSS `[data-rozie-s-xyz]` matches it.
  return `${ctx.scopeAttr}=""`;
}

/**
 * Phase 15 — synthesize a virtual `Listener` from a `ListenerSpreadIR`'s
 * `literalKeys[i]` entry so the per-key dispatcher merge in
 * `emitElementEvents` can fold literal-key spread handlers in alongside
 * `@event` handlers. Solid-side mirror of the React helper.
 */
function listenerFromLiteralKey(
  spread: ListenerSpreadIR,
  literalKey: NonNullable<ListenerSpreadIR['literalKeys']>[number],
): Listener {
  return {
    type: 'Listener',
    target: { kind: 'self', el: '$el' },
    event: literalKey.eventName,
    modifierPipeline: literalKey.modifierPipeline,
    when: null,
    handler: literalKey.valueExpr,
    deps: spread.deps,
    source: 'template-event',
    sourceLoc: spread.sourceLoc,
  };
}

/**
 * Phase 15 R6 — does this element have at least one dynamic spread? See the
 * React-side sibling for the merge-classification rationale.
 */
function hasDynamicListenerSpread(node: TemplateElementIR): boolean {
  for (const spread of node.listenerSpreads) {
    if (spread.literalKeys === undefined || spread.literalKeys.length === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Phase 16 — bare-identifier name match for spread-expression de-duplication.
 * Returns true when `expr` is an Identifier with the given name (e.g. `$attrs`,
 * `$listeners`). Mirrors the duck-typed `obj['type'] === 'Identifier'` form
 * used elsewhere in this file (no @babel/types import needed; the IR field is
 * declared as `Expression` which already narrows via the discriminator).
 */
function isBareIdentifierExpr(
  expr: ListenerSpreadIR['expression'],
  name: string,
): boolean {
  return (
    (expr as { type?: string }).type === 'Identifier' &&
    (expr as { name?: string }).name === name
  );
}

/**
 * Phase 16 — true when `attrs` carries at least one `spreadBinding` whose
 * expression is the bare `$attrs` Identifier. Used by the listener-emit fast
 * path to recognise the Solid-specific spread-redundancy condition (see the
 * `emitElementListeners` early-return below for the rationale).
 */
function hasBareAttrsSpread(attrs: AttributeBinding[]): boolean {
  for (const a of attrs) {
    if (a.kind === 'spreadBinding' && isBareIdentifierExpr(a.expression, '$attrs')) {
      return true;
    }
  }
  return false;
}

/**
 * Phase 15 R6 — assemble the per-element listener emit for Solid. Mirrors
 * the React structural logic line-for-line; Solid's JSX listener-prop
 * convention (`onClick`, `onMouseEnter`) is identical to React's.
 *
 * Returns `{ eventsJsx, extraSpreads }` for placement alongside other JSX
 * attributes / after attributes respectively. See the React sibling for the
 * three-case algorithm: no-spreads / all-literal-merge / mixed-or-dynamic.
 */
function emitElementListeners(
  node: TemplateElementIR,
  ctx: EmitNodeCtx,
): { eventsJsx: string; extraSpreads: string[] } {
  const hasEvents = node.events.length > 0;
  const hasSpreads = node.listenerSpreads.length > 0;

  if (!hasEvents && !hasSpreads) {
    return { eventsJsx: '', extraSpreads: [] };
  }

  if (!hasSpreads) {
    return { eventsJsx: emitElementEvents(node, ctx), extraSpreads: [] };
  }

  const dynamic = hasDynamicListenerSpread(node);

  // CASE: all-literal merge.
  if (!dynamic) {
    const syntheticEvents: Listener[] = [];
    for (const spread of node.listenerSpreads) {
      for (const lk of spread.literalKeys ?? []) {
        syntheticEvents.push(listenerFromLiteralKey(spread, lk));
      }
    }
    const merged: TemplateElementIR = {
      ...node,
      events: [...node.events, ...syntheticEvents],
    };
    return { eventsJsx: emitElementEvents(merged, ctx), extraSpreads: [] };
  }

  // CASE: single dynamic-spread, no events — direct emit with no runtime
  // merge overhead. Covers `r-on="$listeners"` auto-fallthrough on elements
  // with no `@event` handlers (the most common case).
  if (!hasEvents && node.listenerSpreads.length === 1) {
    const only = node.listenerSpreads[0]!;
    // Phase 16 — Solid-specific spread-redundancy elimination. Both `$attrs`
    // and `$listeners` lower to the bare identifier `attrs` in Solid (see
    // `packages/targets/solid/src/rewrite/rewriteTemplateExpression.ts` —
    // they resolve to the SAME rest-of-props bucket because Solid's
    // splitProps produces one bucket and both sigils route through it). When
    // both a `spreadBinding($attrs)` and a bare-`$listeners` listener spread
    // land on the same element, the emit would produce two consecutive
    // `{...attrs}` spreads sandwiching the merged `class={...}` attribute.
    // Solid's `mergeProps` reverse-iter last-wins semantics then make the
    // second spread shadow the merged-class getter (the regression that took
    // all 5 `ThemedButtonConsumer · solid` VR cells off-baseline in Phase
    // 15 — see matrix.spec.ts gate comments + ThemedButton.solid.tsx fixture
    // history). Skip the redundant listener spread: the attribute-side
    // `{...attrs}` already delivers every key (Solid's rest-of-props bucket
    // holds attribute keys AND `on*` listener keys together; the listener
    // spread emits exactly the same set).
    if (
      isBareIdentifierExpr(only.expression, '$listeners') &&
      hasBareAttrsSpread(node.attributes)
    ) {
      return { eventsJsx: '', extraSpreads: [] };
    }
    const attrCtx: import('./emitTemplateAttribute.js').EmitAttrCtx = {
      ir: ctx.ir,
      collectors: ctx.collectors,
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,    };
    return { eventsJsx: '', extraSpreads: [emitListenerSpread(only, attrCtx)] };
  }

  // CASE: mixed / dynamic merge — single runtime `mergeListeners(...)` call.
  type EmittedAttr = { jsxName: string; body: string };
  const emitted: EmittedAttr[] = [];
  for (const ev of node.events) {
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
      scriptInjections: ctx.scriptInjections,
      // Phase 16 R2 / D-03 — thread the For-body loop-accessor set into
      // event-handler lowering so call-arg index references emit as `index()`.
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,
      elementTag: node.tagKind === 'html' ? node.tagName : undefined,    });
    for (const d of result.diagnostics) ctx.diagnostics.push(d);
    const match = result.jsxAttr.match(/^([A-Za-z][\w]*)=\{(.*)\}$/s);
    if (!match) continue;
    emitted.push({ jsxName: match[1]!, body: match[2]! });
  }
  const eventGroups = new Map<string, EmittedAttr[]>();
  const eventOrder: string[] = [];
  for (const e of emitted) {
    if (!eventGroups.has(e.jsxName)) {
      eventGroups.set(e.jsxName, []);
      eventOrder.push(e.jsxName);
    }
    eventGroups.get(e.jsxName)!.push(e);
  }
  const eventsPartialEntries: string[] = [];
  for (const name of eventOrder) {
    const items = eventGroups.get(name)!;
    if (items.length === 1) {
      eventsPartialEntries.push(`${name}: ${items[0]!.body}`);
      continue;
    }
    const branches = items.map((it) =>
      /^[A-Za-z_$][\w$]*$/.test(it.body)
        ? `${it.body}($event);`
        : `(${it.body})($event);`,
    );
    eventsPartialEntries.push(
      // Spike-012 NEW-3 — annotate the synthesized dispatcher param with the
      // event's specific DOM interface (`name` is the JSX prop, e.g. onKeyDown)
      // so a strict consumer (`noImplicitAny`) typechecks and the param is
      // assignable to each inner typed handler arrow.
      `${name}: ($event: ${solidEventParamType(name, node.tagKind === 'html' ? node.tagName : undefined)}) => { ${branches.join(' ')} }`,
    );
  }

  const mergeArgs: string[] = [];
  if (eventsPartialEntries.length > 0) {
    mergeArgs.push(`{ ${eventsPartialEntries.join(', ')} }`);
  }
  const attrCtx: import('./emitTemplateAttribute.js').EmitAttrCtx = {
    ir: ctx.ir,
    collectors: ctx.collectors,
    invokeAccessors: ctx.invokeAccessors,
    loopValueBindings: ctx.loopValueBindings,  };
  for (const spread of node.listenerSpreads) {
    mergeArgs.push(emitListenerSpreadAsMergePartial(spread, attrCtx));
  }

  ctx.collectors.runtime.add('mergeListeners');
  const spreadToken = `{...mergeListeners(${mergeArgs.join(', ')})}`;
  return { eventsJsx: '', extraSpreads: [spreadToken] };
}

/**
 * Emit all @event listeners on an element, merging multiple listeners that
 * map to the same JSX prop (e.g., @keydown.enter + @keydown.escape → onKeyDown).
 *
 * Phase 15 R6 extension: literal-key `r-on` spread entries synthesize virtual
 * `Listener` entries (via `listenerFromLiteralKey`) and participate in the
 * same per-key dispatcher merge as `@event` handlers.
 */
function emitElementEvents(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  if (node.events.length === 0) return '';

  type EmittedAttr = { jsxName: string; body: string };
  const emitted: EmittedAttr[] = [];

  for (const ev of node.events) {
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
      scriptInjections: ctx.scriptInjections,
      // Phase 16 R2 / D-03 — thread the For-body loop-accessor set into
      // event-handler lowering so call-arg index references emit as `index()`.
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,
      elementTag: node.tagKind === 'html' ? node.tagName : undefined,    });
    for (const d of result.diagnostics) ctx.diagnostics.push(d);

    // Parse `<jsxName>={<body>}` so we can re-group when names collide.
    const match = result.jsxAttr.match(/^([A-Za-z][\w]*)=\{(.*)\}$/s);
    if (!match) {
      emitted.push({ jsxName: '', body: result.jsxAttr });
      continue;
    }
    emitted.push({ jsxName: match[1]!, body: match[2]! });
  }

  // Group by jsxName, preserving order (same as React target's dispatcher-merge).
  const groups = new Map<string, EmittedAttr[]>();
  const order: string[] = [];
  for (const e of emitted) {
    if (!groups.has(e.jsxName)) {
      groups.set(e.jsxName, []);
      order.push(e.jsxName);
    }
    groups.get(e.jsxName)!.push(e);
  }

  const out: string[] = [];
  for (const name of order) {
    const items = groups.get(name)!;
    if (items.length === 1) {
      const it = items[0]!;
      if (it.jsxName === '') out.push(it.body);
      else out.push(`${it.jsxName}={${it.body}}`);
      continue;
    }
    // Multi-listener merge: build a dispatcher arrow.
    const branches = items.map((it) => {
      const body = it.body;
      if (/^[A-Za-z_$][\w$]*$/.test(body)) {
        return `${body}($event);`;
      }
      return `(${body})($event);`;
    });
    // Spike-012 NEW-3 — typed dispatcher param (strict-consumer TS7006); the
    // event's specific DOM interface (`name` is the JSX prop, e.g. onKeyDown).
    const dispatcher = `($event: ${solidEventParamType(name, node.tagKind === 'html' ? node.tagName : undefined)}) => { ${branches.join(' ')} }`;
    out.push(`${name}={${dispatcher}}`);
  }
  return out.join(' ');
}

/**
 * Parse a JSX attribute string into named props.
 * Returns a map of { propName -> body } where body is the content inside {}.
 * Non-event attributes (no `=`) and unrecognised patterns are left unparsed
 * and returned in the `rest` array.
 */
function parseNamedProps(attrStr: string): { named: Map<string, string>; rest: string[] } {
  const named = new Map<string, string>();
  const rest: string[] = [];
  if (!attrStr.trim()) return { named, rest };

  // Split on top-level whitespace — but attribute values can contain balanced {} braces.
  // Strategy: scan char-by-char, splitting on whitespace only when brace depth === 0.
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < attrStr.length; i++) {
    const ch = attrStr[i]!;
    if (ch === '{') { depth++; cur += ch; }
    else if (ch === '}') { depth--; cur += ch; }
    else if ((ch === ' ' || ch === '\t' || ch === '\n') && depth === 0) {
      if (cur.trim()) tokens.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) tokens.push(cur.trim());

  for (const tok of tokens) {
    // Match `propName={...}` where the body starts with { and ends with }.
    const eqIdx = tok.indexOf('=');
    if (eqIdx > 0 && tok[eqIdx + 1] === '{' && tok[tok.length - 1] === '}') {
      const name = tok.slice(0, eqIdx);
      const body = tok.slice(eqIdx + 2, tok.length - 1); // strip `={` and `}`
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        named.set(name, body);
        continue;
      }
    }
    rest.push(tok);
  }

  return { named, rest };
}

/**
 * Merge duplicate event-prop strings between the static-attrs output and the
 * events-handler output.  When r-model and @event.modifier both generate
 * (e.g.) `onInput={}`, merging prevents TS17001 (duplicate JSX attributes).
 *
 * Algorithm:
 *  1. Parse both strings into named-prop maps.
 *  2. For names that appear in both: build a merged dispatcher arrow.
 *  3. Reassemble the combined attribute string.
 */
function mergeEventAttributes(
  attrsJsx: string,
  eventsJsx: string,
  elementTag?: string,
): string {
  if (!attrsJsx.trim() || !eventsJsx.trim()) {
    return [attrsJsx, eventsJsx].filter(Boolean).join(' ');
  }

  const { named: attrsNamed, rest: attrsRest } = parseNamedProps(attrsJsx);
  const { named: eventsNamed, rest: eventsRest } = parseNamedProps(eventsJsx);

  const merged: string[] = [...attrsRest, ...eventsRest];

  // All names from attrsNamed — merge with eventsNamed if duplicate.
  for (const [name, attrsBody] of attrsNamed) {
    const eventsBody = eventsNamed.get(name);
    if (eventsBody !== undefined) {
      // Merge: build a dispatcher that calls both handlers with `e`.
      const wrap = (body: string) => {
        // If body is already a bare identifier, call it; otherwise invoke the expression.
        if (/^[A-Za-z_$][\w$]*$/.test(body)) return `${body}($event);`;
        return `(${body})($event);`;
      };
      // Spike-012 NEW-3 — typed dispatcher param (strict-consumer TS7006); the
      // event's specific DOM interface (`name` is the JSX prop, e.g. onKeyDown).
      merged.push(`${name}={($event: ${solidEventParamType(name, elementTag)}) => { ${wrap(attrsBody)} ${wrap(eventsBody)} }}`);
      eventsNamed.delete(name);
    } else {
      merged.push(`${name}={${attrsBody}}`);
    }
  }

  // Remaining names only in eventsNamed.
  for (const [name, body] of eventsNamed) {
    merged.push(`${name}={${body}}`);
  }

  return merged.join(' ');
}

/**
 * Emit a TemplateElement. Applies element-level special-cases (r-show, r-html,
 * r-text, r-model) then falls through to standard tag/attr/children form.
 *
 * Keyed-remount codegen Task 5 — a component-level `:key="expr"` (NOT under
 * r-for; that path owns `key` via `TemplateLoopIR.keyExpression` and never
 * sets this field — see Task 1's Global Constraints) lowers to
 * `remountKeyExpression`. Solid's native destroy+recreate primitive is
 * `<Show keyed when={...}>` (the `keyed` prop forces the children to be torn
 * down and rebuilt whenever `when`'s value changes, rather than just toggling
 * visibility). We wrap the ENTIRE emitted component invocation in it. The raw
 * `key`/`:key` binding was ALREADY dropped for Solid before this task (see
 * `isConsumedAttribute` in emitTemplateAttribute.ts) — there is no inert prop
 * to additionally strip here, only the wrap to add.
 *
 * FALSY-KEY GUARD: `<Show when={x}>` also GATES visibility — it hides its
 * children whenever `x` is falsy. A real remount key can legitimately be a
 * falsy value (`String(0)` is truthy, but a raw `0`/`false`/`''` key is not
 * out of the question), so binding `when` directly to the raw key expression
 * would make the component disappear whenever the key is falsy — a much
 * worse bug than the dropped-key status quo. We guard by prefixing a
 * non-empty literal (`` `k${expr}` ``): the resulting string is NEVER empty
 * (so the child is never hidden) while still changing value — and thus
 * still triggering `keyed` recreation — whenever the underlying key changes.
 */
function emitElement(origNode: TemplateElementIR, ctx: EmitNodeCtx): string {
  const markup = emitElementInner(origNode, ctx);

  if (
    (origNode.tagKind === 'component' || origNode.tagKind === 'self') &&
    origNode.remountKeyExpression
  ) {
    const keyExprCode = rewriteTemplateExpression(origNode.remountKeyExpression, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    ctx.collectors.solid.add('Show');
    return `<Show keyed when={\`k\${${keyExprCode}}\`}>${markup}</Show>`;
  }

  return markup;
}

/**
 * tagKind discrimination per D-115:
 *   - 'html': standard HTML element, class stays as `class=` (Solid supports this)
 *   - 'component': PascalCase tag, emit verbatim; cross-rozie imports handled by emitSolid
 *   - 'self': self-reference, emit verbatim PascalCase (JS scope resolves it)
 */
function emitElementInner(origNode: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Phase 71 (r-keynav) — strip the synthetic `@keynav-commit` listener
  // BEFORE any listener emission runs; it's routed into `createKeynav`'s
  // `onCommit` option by `emitTemplate.ts`, never as a JSX `onKeynavCommit=`
  // prop (see emitKeynav.ts's `stripKeynavCommitEvent` doc comment). No-op
  // (returns the SAME node) for every element that isn't a keynav root.
  const node = stripKeynavCommitEvent(origNode);

  let workingAttrs: AttributeBinding[] = [...node.attributes];

  const scopeAttrJsx = scopeAttrForElement(node, ctx);
  // Phase 71 (r-keynav) — root `ref={...}`/`aria-activedescendant` and item
  // `id`/`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabIndex`
  // fragments. Both resolve to `[]` for the overwhelming majority of
  // elements (no keynav plan, or this element carries neither marker) — a
  // cheap two-property check, not a tree walk, so non-keynav components pay
  // no emission cost (SPEC §11: "no corpus rebless").
  const keynav = ctx.keynav ?? null;
  const keynavAttrs = [
    ...keynavRootAttrs(keynav, node),
    ...keynavItemAttrs(keynav, node, ctx.keynavItemIndexAlias ?? null),
  ];

  // r-html special-case
  const rHtmlAttr = findAttribute(workingAttrs, 'r-html');
  if (rHtmlAttr && rHtmlAttr.kind === 'binding') {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_SOLID_RESERVED,
        severity: 'warning',
        message: `<${node.tagName}> r-html on element with children — children dropped (Pitfall 10).`,
        loc: rHtmlAttr.sourceLoc,
      });
    }
    const exprCode = rewriteTemplateExpression(rHtmlAttr.expression, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    workingAttrs = workingAttrs.filter((a) => a !== rHtmlAttr);
    const attrsResult = emitAttributes(workingAttrs, { ir: ctx.ir, collectors: ctx.collectors, invokeAccessors: ctx.invokeAccessors, loopValueBindings: ctx.loopValueBindings, scopeAccessorParams: ctx.scopeAccessorParams, elementTagKind: node.tagKind, tagName: node.tagName });
    for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);
    const listenerResult = emitElementListeners(node, ctx);
    const headParts = [
      attrsResult.jsx,
      listenerResult.eventsJsx,
      ...listenerResult.extraSpreads,
      `innerHTML={${exprCode}}`,
      ...keynavAttrs,
    ].filter(Boolean);
    if (scopeAttrJsx) headParts.push(scopeAttrJsx);
    const head = headParts.length > 0 ? ' ' + headParts.join(' ') : '';
    return `<${node.tagName}${head} />`;
  }

  // r-text special-case
  const rTextAttr = findAttribute(workingAttrs, 'r-text');
  let rTextChildren: string | null = null;
  if (rTextAttr && rTextAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rTextAttr.expression, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    rTextChildren = `{${exprCode}}`;
    workingAttrs = workingAttrs.filter((a) => a !== rTextAttr);
  }

  // r-show special-case: emit style={{ display: cond ? '' : 'none' }}
  // Note: In Solid, style prop takes an object OR a string. For conditional
  // display, emit style={{ display: (cond) ? '' : 'none' }}.
  const rShowAttr = findAttribute(workingAttrs, 'r-show');
  let rShowStyleAttr: string | null = null;
  if (rShowAttr && rShowAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rShowAttr.expression, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    rShowStyleAttr = `style={{ display: (${exprCode}) ? '' : 'none' }}`;
    workingAttrs = workingAttrs.filter((a) => a !== rShowAttr);
  }

  // r-model special-case
  const rModelAttr = findAttribute(workingAttrs, 'r-model');
  if (rModelAttr) {
    const rModelResult = emitRModel(node, ctx.ir);
    for (const d of rModelResult.diagnostics) ctx.diagnostics.push(d);
    if (rModelResult.replacementAttributes.length > 0) {
      workingAttrs = workingAttrs.filter((a) => a !== rModelAttr);
      workingAttrs = [...workingAttrs, ...rModelResult.replacementAttributes];
    }
  }

  // Standard attribute emission
  const attrsResult = emitAttributes(workingAttrs, { ir: ctx.ir, collectors: ctx.collectors, invokeAccessors: ctx.invokeAccessors, loopValueBindings: ctx.loopValueBindings, scopeAccessorParams: ctx.scopeAccessorParams, elementTagKind: node.tagKind, tagName: node.tagName });
  for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);

  const listenerResult = emitElementListeners(node, ctx);

  // Merge duplicate event props between attrs (r-model) and events (@event.modifier).
  // r-model generates onInput= as an attribute string; @input.debounce generates another
  // onInput= via emitElementEvents. Merging produces a single dispatcher arrow.
  // Phase 15: the runtime `{...mergeListeners(...)}` spread (when dynamic
  // R6 merge is in play) does NOT collide with r-model's onInput attribute
  // string — the spread is an opaque `...{}` token — so we append it after
  // mergeEventAttributes finishes.
  const headParts = [
    mergeEventAttributes(
      attrsResult.jsx,
      listenerResult.eventsJsx,
      node.tagKind === 'html' ? node.tagName : undefined,
    ),
    ...listenerResult.extraSpreads,
    ...keynavAttrs,
  ];
  if (rShowStyleAttr) headParts.push(rShowStyleAttr);
  if (scopeAttrJsx) headParts.push(scopeAttrJsx);

  // Phase 07.2 Plan 03 — Solid consumer-side slot-fill emit (R3 + R4 + R5).
  //
  // When this element is a component-tag (tagKind 'component' | 'self') and
  // carries SlotFillerDecl[] from the lowerer, render the structured fillers
  // instead of the parallel-array raw children. Each filler either becomes a
  // JSX prop assignment (`headerSlot={({ close }) => …}`) OR bare children
  // (default-shorthand without scope — picked up by Solid's
  // `children(() => local.children)` accessor on the producer).
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const fillerProps: string[] = [];
    const childrenParts: string[] = [];
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) continue; // merged into a single slots={…} below
      const out = emitSlotFiller(filler, ctx);
      if (out.kind === 'prop') {
        fillerProps.push(out.text);
      } else {
        childrenParts.push(out.text);
      }
    }
    const dynamicSlotsAttr = emitDynamicSlotsProp(node.slotFillers, ctx);
    if (dynamicSlotsAttr !== null) fillerProps.push(dynamicSlotsAttr);

    const headWithFills = [
      ...headParts.filter(Boolean),
      ...fillerProps,
    ].join(' ');
    const headOutFills = headWithFills.length > 0 ? ' ' + headWithFills : '';

    if (childrenParts.length === 0) {
      // No bare-children fill → self-close, body content lives wholly in
      // JSX prop assignments.
      return `<${node.tagName}${headOutFills} />`;
    }
    // Bare-children fill (default-shorthand without scope) → emit inside.
    const innerFills = childrenParts.join('');
    return `<${node.tagName}${headOutFills}>${innerFills}</${node.tagName}>`;
  }

  const head = headParts.filter(Boolean).join(' ');
  const headOut = head.length > 0 ? ' ' + head : '';

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  if (rTextChildren !== null) {
    return `<${node.tagName}${headOut}>${rTextChildren}</${node.tagName}>`;
  }

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${headOut} />`;
    return `<${node.tagName}${headOut} />`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${node.tagName}${headOut}>${inner}</${node.tagName}>`;
}

/**
 * True when some `r-match` branch test references an `Identifier` named
 * `tempName` — i.e. core actually folded the hoist temp into the rungs.
 *
 * Core classifies a non-`Identifier`/`MemberExpression` discriminant as
 * `hoist` (D-03), but the literal-`true`/`false` predicate-chain form (R4)
 * lowers each rung to a BARE predicate that never references the temp. For
 * that form the hoist wrapper would be a dead `const __rozieMatch_N = true`
 * binding — so the wrapper is emitted only when the temp is genuinely used.
 */
function tempNameIsReferenced(node: TemplateMatchIR, tempName: string): boolean {
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk);
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (obj['type'] === 'Identifier' && obj['name'] === tempName) return true;
    return Object.values(obj).some(walk);
  };
  return node.branches.some((b) => b.test !== null && walk(b.test));
}

/**
 * D-02 — the `r-match` (`TemplateMatch`) delegate.
 *
 * `node.branches` is byte-identical to `TemplateConditionalIR.branches` (the
 * `r-case`/`r-default` tests are pre-folded by core, plan 11-01), so emitting a
 * match is pure delegation: construct a synthetic `TemplateConditional` and
 * hand it to the existing `emitConditional`. No bespoke `emitMatch` logic, no
 * touch to `emitConditional`'s signature.
 *
 * When `node.hostElement` is present (a real-element host, `<div r-match>`),
 * the conditional ladder is rendered as the single child of a synthetic copy
 * of that host element — so the host tag + its attributes survive to emitted
 * output (R8), mirroring how a real-element `r-if` host keeps its tag.
 *
 * The `discriminantMode === 'hoist'` path (D-04 — plan 11-05): an expensive
 * `CallExpression` discriminant must evaluate EXACTLY ONCE per render. The
 * `<Show>` ladder is wrapped in a return-position IIFE that binds the
 * discriminant to `node.tempName` (`__rozieMatch_N`, allocated by core):
 * `{(() => { const <tempName> = <discriminant>; return <ladder>; })()}`. The
 * folded branch tests already reference `t.identifier(node.tempName)`, so each
 * `<Show when>` rung reads the temp, never re-invokes the call. Solid's JSX
 * accepts the same return-position IIFE React uses. A `hoist`-classified
 * literal predicate chain whose rungs never reference the temp falls through
 * to pure delegation — no dead wrapper.
 */
function emitMatchNode(node: TemplateMatchIR, ctx: EmitNodeCtx): string {
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  if (
    node.discriminantMode === 'hoist' &&
    node.tempName !== undefined &&
    tempNameIsReferenced(node, node.tempName)
  ) {
    // D-04 hoist — `emitConditional` returns a `{...}`-wrapped JSX expression;
    // strip the braces and re-wrap as a return-position IIFE binding the
    // discriminant temp once. `node.discriminant` is routed through the SAME
    // `rewriteTemplateExpression` (with the ctx's `invokeAccessors`) the folded
    // branch tests use, so Solid accessor invocation is consistent.
    const ladder = emitConditional(synthetic, ctx, emitNode);
    const inner = ladder.startsWith('{') && ladder.endsWith('}')
      ? ladder.slice(1, -1)
      : ladder;
    const discriminantCode = rewriteTemplateExpression(node.discriminant, ctx.ir, {
      invokeAccessors: ctx.invokeAccessors,
      loopValueBindings: ctx.loopValueBindings,      scopeAccessorParams: ctx.scopeAccessorParams,
    });
    const hoisted = `{(() => { const ${node.tempName} = ${discriminantCode}; return ${inner}; })()}`;
    if (node.hostElement !== undefined) {
      const verbatim: TemplateStaticTextIR = {
        type: 'TemplateStaticText',
        text: hoisted,
        sourceLoc: node.hostElement.sourceLoc,
      };
      const wrapper: TemplateElementIR = {
        ...node.hostElement,
        children: [verbatim],
      };
      return emitElement(wrapper, ctx);
    }
    return hoisted;
  }
  if (node.hostElement !== undefined) {
    const wrapper: TemplateElementIR = {
      ...node.hostElement,
      children: [synthetic],
    };
    return emitElement(wrapper, ctx);
  }
  return emitConditional(synthetic, ctx, emitNode);
}

/**
 * Top-level dispatch.
 */
export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  switch (node.type) {
    case 'TemplateStaticText':
      return emitStaticText(node, ctx);
    case 'TemplateInterpolation':
      return emitInterpolation(node, ctx);
    case 'TemplateFragment':
      return emitFragment(node, ctx);
    case 'TemplateConditional':
      return emitConditional(node, ctx, emitNode);
    case 'TemplateMatch':
      return emitMatchNode(node, ctx);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node, ctx);
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}

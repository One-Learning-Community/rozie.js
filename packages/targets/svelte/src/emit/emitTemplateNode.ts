/**
 * emitTemplateNode — Phase 5 Plan 02a Task 2.
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * Svelte 5 markup string fragments per RESEARCH Pattern 4 emission map:
 *
 *   - r-if/r-else-if/r-else        → {#if x}...{:else if y}...{:else}...{/if}
 *   - r-for + :key                 → {#each items as item (item.id)}...{/each}
 *   - r-for + (item, idx) form     → {#each items as item, idx (item.id)}...
 *   - r-show                       → style:display={x ? '' : 'none'} (no first-class)
 *   - r-html                       → {@html expr} (sibling); ROZ620 if children present
 *   - r-text                       → {expr} (Svelte's text interpolation)
 *   - {{ expr }} interpolation     → {expr}
 *   - @event handler               → onevent={...} (Pitfall 4 — lowercase, no `on:`)
 *   - <slot ...>                   → {@render name?.(args)} or {#if ...}...{/if}
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  Listener,
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import {
  emitAttributes,
  emitListenerSpread,
  findRHtml,
} from './emitTemplateAttribute.js';
import { emitTemplateEvent } from './emitTemplateEvent.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
// Phase 07.2 — consumer-side slot-fill emission for component-tag elements.
import {
  emitSlotFiller,
  emitDynamicSnippetsProp,
} from './emitSlotFiller.js';
import type { SvelteScriptInjection } from './emitScript.js';

/**
 * HTML void elements (no closing tag, self-close `/>`).
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Accumulated script-level injections (debounce/throttle wrappers). */
  scriptInjections: SvelteScriptInjection[];
  /** Per-component counter shared across all events for stable wrap-name suffixes. */
  injectionCounter: { next: number };
  /**
   * Phase 15 — runtime-helper import names. The Svelte template emit pushes
   * `'applyListeners'` here for every dynamic `r-on="<expr>"` listener
   * spread (including the D-19 bare `$listeners` form). The SFC shell
   * threads `import { applyListeners } from '@rozie/runtime-svelte';` when
   * this set is non-empty.
   */
  runtimeImports: Set<string>;
  /**
   * Pre-Phase-16 cleanup Item 2 — per-component scope attribute (e.g.
   * `data-rozie-s-7914ecaa`). When non-empty, `emitElement` stamps it on
   * EVERY emitted element AND on every component-tag invocation
   * (`tagKind === 'component' | 'self'`). The component-invocation stamp is
   * the cross-SFC propagation path: the child's auto-fallthrough machinery
   * (`{...$$restProps}` / synthesized `$attrs` spread) carries the
   * consumer's scope attribute onto the child's rendered root, so the
   * consumer's class-on-component CSS rules match. Mirrors the react/solid/
   * lit pattern; Svelte was the lone hold-out that previously relied on
   * Svelte's native `.svelte-<hash>` class-hashing (which does NOT
   * propagate across SFC compile units). Empty string = no stamping (the
   * pre-Item-2 verbatim emit path, used by degenerate test-only callers).
   */
  scopeAttr: string;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  // Svelte preserves whitespace inside elements; htmlparser2 already produced
  // clean text. Curly braces in static text would be problematic, but our
  // examples don't include them.
  return node.text;
}

/**
 * Debug fix(33-04) (tiptap-nodeview svelte reflow) — drop insignificant
 * inter-element whitespace, matching the JSX/Vue rule the other 5 targets
 * already apply.
 *
 * Root cause: the `.rozie` source formats sibling elements across lines
 * (`</span>\n        <span>`), producing whitespace-only `TemplateStaticText`
 * IR nodes between them. React/Solid (JSX runtime) and Vue (compiler
 * `whitespace: 'condense'`) collapse such nodes; Svelte renders them as real
 * text nodes. Inside an `display:inline` fragment containing block children
 * (the grafted TipTap node-view), each surviving whitespace node creates an
 * extra inline line-box — the node-view rendered ~50px taller on Svelte only
 * (callout 69px vs 51px on the other 5 targets), the sole remaining 6/6 pixel
 * divergence.
 *
 * The rule is JSX-exact: a `TemplateStaticText` node is dropped iff it is
 * whitespace-only AND contains a newline (i.e. it is layout-formatting
 * whitespace between tags on separate source lines). Whitespace WITHOUT a
 * newline — deliberate inline spacing such as `Hello <b>world</b>` written on
 * one line, or a space between text and an interpolation — is preserved, so
 * meaningful spacing is never lost. This mirrors React/Babel's JSX whitespace
 * collapsing precisely.
 */
function isInsignificantWhitespaceText(node: TemplateNode): boolean {
  if (node.type !== 'TemplateStaticText') return false;
  const t = node.text;
  return t.length > 0 && t.trim() === '' && t.includes('\n');
}

/**
 * Emit a children array to a joined Svelte markup string, dropping
 * insignificant inter-element whitespace (see `isInsignificantWhitespaceText`).
 * Single shared path so every children-emit site collapses whitespace
 * identically — matching the other 5 targets and keeping the rule in one place.
 */
function emitChildrenJoined(children: readonly TemplateNode[], ctx: EmitNodeCtx): string {
  return children
    .filter((c) => !isInsignificantWhitespaceText(c))
    .map((c) => emitNode(c, ctx))
    .join('');
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ctx: EmitNodeCtx,
): string {
  const expr = rewriteTemplateExpression(node.expression, ctx.ir);
  // Phase 26 (D-06/D-07) — gate on the IR-precomputed wrap decision. A
  // non-primitive value renders portable JSON (`[object Object]` divergence
  // eliminated); raw when provably string|number|boolean or safeInterpolation
  // is off (SPEC-3, byte-identical to pre-phase). Svelte 5 accepts any JS in
  // `{}`; the `__rozie`-prefix on the helper avoids the `$`-name reservation.
  if (node.wrapForDisplay) {
    ctx.runtimeImports.add('rozieDisplay');
    return `{rozieDisplay(${expr})}`;
  }
  return `{${expr}}`;
}

function emitFragment(
  node: TemplateFragmentIR,
  ctx: EmitNodeCtx,
): string {
  return emitChildrenJoined(node.children, ctx);
}

/**
 * Emit a TemplateConditional as `{#if a}...{:else if b}...{:else}...{/if}`
 * Phase 2 collapses r-if + r-else-if + r-else into branches[].
 */
function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
): string {
  const parts: string[] = [];
  for (let i = 0; i < node.branches.length; i++) {
    const branch = node.branches[i]!;
    const inner = emitChildrenJoined(branch.body, ctx);
    if (i === 0) {
      const test = branch.test
        ? rewriteTemplateExpression(branch.test, ctx.ir)
        : 'true';
      parts.push(`{#if ${test}}`);
    } else if (branch.test) {
      const test = rewriteTemplateExpression(branch.test, ctx.ir);
      parts.push(`{:else if ${test}}`);
    } else {
      parts.push(`{:else}`);
    }
    parts.push(inner);
  }
  parts.push(`{/if}`);
  return parts.join('');
}

/**
 * Emit a TemplateLoop as `{#each items as item (item.id)}...{/each}`.
 *
 * The loop's `body[0]` is the bare element WITHOUT r-for (Phase 2 stripped
 * it) but the inner element MAY still carry `:key` — we strip it here so it
 * doesn't double-emit alongside the loop's `(key)` directive.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  const iter = rewriteTemplateExpression(node.iterableExpression, ctx.ir);
  const itemDecl = node.indexAlias
    ? `${node.itemAlias}, ${node.indexAlias}`
    : node.itemAlias;
  const keySuffix = node.keyExpression
    ? ` (${rewriteTemplateExpression(node.keyExpression, ctx.ir)})`
    : '';

  // Strip `:key` from the inner element to avoid duplicate emission.
  const stripKey = (n: TemplateNode): TemplateNode => {
    if (n.type !== 'TemplateElement') return n;
    return {
      ...n,
      attributes: n.attributes.filter(
        (a) => !(a.kind === 'binding' && a.name === 'key'),
      ),
    };
  };

  const innerNodes = node.body.map(stripKey);
  const inner = emitChildrenJoined(innerNodes, ctx);

  return `{#each ${iter} as ${itemDecl}${keySuffix}}${inner}{/each}`;
}

/**
 * Phase 15 — synthesize a virtual `Listener` from a `ListenerSpreadIR`'s
 * `literalKeys[i]` entry so the per-key dispatcher merge in `emitEvents` can
 * fold literal-key spread handlers in alongside `@event` handlers. Mirror
 * of the React + Vue target's `listenerFromLiteralKey`.
 *
 * Each literal-key entry carries `{ eventName, modifierPipeline, valueExpr }`
 * — enough to fabricate a Listener with the same shape `emitTemplateEvent`
 * already consumes from `el.events`. `target` defaults to `'self'`; `when`
 * is null; `deps` inherits the parent spread's deps; `source` is
 * `'template-event'` (codegen path treats both sources identically).
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
 * Emit element events. Each Listener returns one event-attribute string plus
 * an optional scriptInjection (debounce/throttle wrap).
 *
 * Multiple listeners on the SAME DOM event (e.g., `@keydown.enter="x"` AND
 * `@keydown.escape="y"`) MUST merge into a single `onkeydown={...}` handler
 * — Svelte rejects duplicate attribute names on the same element. We
 * synthesize a single arrow that runs each handler's inlineGuards + body in
 * sequence; the inlineGuards' early-returns (e.g., `if ($event.key !== 'Enter')
 * return`) naturally route the event to the correct user handler.
 *
 * Phase 15 R6 — this same merge path is reused for literal-key `r-on` spread
 * entries (synthesized via `listenerFromLiteralKey`) — e.g.
 * `@click="f1" r-on="{ click: f2 }"` produces a single
 * `onclick={($event) => { f1($event); f2($event); }}` dispatcher.
 */
function emitEvents(events: Listener[], ctx: EmitNodeCtx): string {
  if (events.length === 0) return '';

  // Group by lowercase event name (the Svelte attribute name).
  const groups = new Map<string, Listener[]>();
  for (const ev of events) {
    const key = ev.event.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }

  const out: string[] = [];

  for (const [eventName, group] of groups) {
    if (group.length === 1) {
      // Single listener — defer to emitTemplateEvent's standard emission.
      const result = emitTemplateEvent(group[0]!, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
      });
      out.push(result.eventAttr);
      if (result.scriptInjection) ctx.scriptInjections.push(result.scriptInjection);
      for (const d of result.diagnostics) ctx.diagnostics.push(d);
      continue;
    }

    // Multiple listeners — merge into a single arrow. We synthesize each
    // handler's body inline (inlineGuards + invocation) inside an IIFE block.
    const handlerBodies: string[] = [];
    for (const ev of group) {
      const result = emitTemplateEvent(ev, {
        ir: ctx.ir,
        registry: ctx.registry,
        injectionCounter: ctx.injectionCounter,
      });
      if (result.scriptInjection) ctx.scriptInjections.push(result.scriptInjection);
      for (const d of result.diagnostics) ctx.diagnostics.push(d);
      // Extract the inner arrow body. emitTemplateEvent always returns either
      //   `onevent={handler}` (bare identifier) — we wrap as `handler($event);`
      //   `onevent={($event) => { ...body... }}` — we lift the `...body...` out.
      const m = result.eventAttr.match(/^on[a-z]+=\{(.*)\}$/s);
      if (!m) continue;
      const inner = m[1]!;
      // Bare identifier handler:
      if (/^[A-Za-z_$][\w$]*$/.test(inner)) {
        // Cast to permissive Fn so the `($event)` forward type-checks even when the
        // user-authored handler is `() => void` (see SearchInput's onSearch /
        // clear merged into the onkeydown handler).
        handlerBodies.push(`(() => { (${inner} as (...a: any[]) => any)($event); })();`);
        continue;
      }
      // Arrow shape `($event) => { body }` — extract body.
      const arrowMatch = inner.match(/^\(e\) => \{\s*([\s\S]*?)\s*\}$/);
      if (arrowMatch) {
        handlerBodies.push(`(() => { ${arrowMatch[1]!} })();`);
        continue;
      }
      // Fallback — wrap whatever it is in a callable IIFE.
      handlerBodies.push(`(() => { (${inner})($event); })();`);
    }

    const merged = `on${eventName}={($event) => { ${handlerBodies.join(' ')} }}`;
    out.push(merged);
  }

  return out.join(' ');
}

/**
 * Emit a TemplateElement. Walks attributes (filtering r-html for sibling
 * emission) and events; renders children. Self-closes void elements with
 * no children.
 *
 * Phase 06.2 P2: tagKind === 'component' | 'self' — Svelte 5 resolves both
 * via the top-of-script import binding (self-import idiom per D-117 update
 * 2026-05-07; `<svelte:self>` NOT used). Both emit the verbatim PascalCase
 * tag below; no template AST rewrite needed.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  // 260519 linechart-watch-recreate step 5 — resolve the host's static `type`
  // attribute when it is an `<input>`, so emitAttributes can route an
  // `r-model` on a `<input type="checkbox">` to `bind:checked` instead of
  // `bind:value`. Only a STATIC type attribute is read — a bound `:type` is a
  // runtime value the static emitter can't resolve, and r-model on a
  // dynamically-typed input is an unsupported edge case anyway.
  let inputType: string | undefined;
  if (node.tagName.toLowerCase() === 'input') {
    for (const a of node.attributes) {
      if (a.kind === 'static' && a.name === 'type') {
        inputType = a.value.toLowerCase();
        break;
      }
    }
  }
  // Pre-Phase-16 Item-2-residual — detect a bare-`$attrs` spreadBinding on
  // the same element. When present, `:style="{...}"` object-literal lowering
  // routes through the string-form `style="..."` path so the consumer's
  // spread `style` value can overwrite the wrapper's defaults (the
  // cross-target consumer-wins precedence). See EmitAttrCtx.hasFallthroughSpread.
  let hasFallthroughSpread = false;
  for (const a of node.attributes) {
    if (
      a.kind === 'spreadBinding' &&
      a.expression.type === 'Identifier' &&
      a.expression.name === '$attrs'
    ) {
      hasFallthroughSpread = true;
      break;
    }
  }
  const attrText = emitAttributes(node.attributes, {
    ir: ctx.ir,
    elementTagKind: node.tagKind,
    // Phase 26 — thread the runtime-import accumulator so attribute/class
    // interpolations can register `rozieDisplay` when they wrap.
    runtimeImports: ctx.runtimeImports,
    // Spread only when defined — `exactOptionalPropertyTypes` rejects an
    // explicit `inputType: undefined` against the optional `inputType?` field.
    ...(inputType !== undefined ? { inputType } : {}),
    ...(hasFallthroughSpread ? { hasFallthroughSpread: true } : {}),
  });

  // Phase 15 R6 — assemble the per-element listener emit. Literal-key
  // spreads are decomposed into synthetic `Listener` entries spliced into
  // the events list (so modifier-bearing keys like `'click.stop'` reuse
  // the existing `emitTemplateEvent.ts` modifier-pipeline emit; the
  // existing `emitEvents` same-event grouping handles R6 collision merge
  // automatically — two listeners on the same lowercase event name fold
  // into a single `oneventname={($event) => { f1($event); f2($event); }}`
  // dispatcher). Dynamic spreads emit as separate `use:applyListeners=`
  // directives — Svelte 5 has NO native object-form listener directive,
  // so the action provides the attach/detach lifecycle (D-11 lock); the
  // `addEventListener` calls inside the action stack with native
  // `on:event=` directives on the same DOM event, so all-fire happens
  // automatically (NO runtime `mergeListeners` helper for Svelte;
  // divergence from React/Solid).
  const syntheticEvents: Listener[] = [];
  const dynamicSpreads: ListenerSpreadIR[] = [];
  // Defensive: synthetic test-IR may omit `listenerSpreads` (the real
  // lowered IR always sets `[]` by construction per Plan 15-01).
  for (const spread of node.listenerSpreads ?? []) {
    const literalKeys = spread.literalKeys;
    if (literalKeys !== undefined && literalKeys.length > 0) {
      for (const lk of literalKeys) {
        syntheticEvents.push(listenerFromLiteralKey(spread, lk));
      }
    } else {
      dynamicSpreads.push(spread);
    }
  }
  const allEvents: Listener[] = [...node.events, ...syntheticEvents];
  const eventText = emitEvents(allEvents, ctx);

  // Dynamic spreads → one `use:applyListeners={<expr>}` action per spread.
  // Each routes through `emitListenerSpread` which collects the
  // `applyListeners` runtime-import marker.
  const spreadTexts: string[] = [];
  if (dynamicSpreads.length > 0) {
    const attrCtx: import('./emitTemplateAttribute.js').EmitAttrCtx = {
      ir: ctx.ir,
    };
    for (const spread of dynamicSpreads) {
      spreadTexts.push(emitListenerSpread(spread, attrCtx, ctx.runtimeImports));
    }
  }

  const rHtml = findRHtml(node.attributes);

  const partsHead: string[] = [];
  if (attrText) partsHead.push(attrText);
  if (eventText) partsHead.push(eventText);
  for (const sp of spreadTexts) partsHead.push(sp);
  // Pre-Phase-16 Item 2: stamp the per-component scope attribute on every
  // emitted element AND on every component-tag invocation. The element-side
  // stamp matches the `[data-rozie-s-<hash>]` selector that `scopeCss`
  // appended to every scoped rule. The component-tag stamp is the cross-SFC
  // propagation path — the child's auto-fallthrough machinery delivers the
  // consumer's scope attribute onto the child's rendered root, so the
  // consumer's class-on-component CSS rules match. Mirrors react/solid/lit;
  // see the EmitNodeCtx.scopeAttr docstring for why Svelte needed to switch
  // off its native scoper for this to work.
  if (ctx.scopeAttr.length > 0) {
    partsHead.push(ctx.scopeAttr);
  }
  const head = partsHead.length > 0 ? ' ' + partsHead.join(' ') : '';

  // r-html: ROZ620 when coexistent with children; emit `{@html expr}` content.
  if (rHtml !== null) {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RHTML_WITH_CHILDREN, // ROZ620
        severity: 'error',
        message: `r-html cannot coexist with template children on the same element. Move r-html to a child element or remove the children.`,
        loc: node.sourceLoc,
      });
    }
    const expr = rewriteTemplateExpression(rHtml.expression, ctx.ir);
    return `<${node.tagName}${head}>{@html ${expr}}</${node.tagName}>`;
  }

  // Phase 07.2 — component-tag with slot fillers: render fillers as Svelte 5
  // snippet blocks inside the component tag instead of raw children.
  //
  // The parallel-array lowering invariant (lowerSlotFillers.ts L186-310)
  // means node.children and node.slotFillers reference the SAME body content
  // — extractSlotFillers walks parallel arrays without stripping children.
  // To avoid double-emission, emit the structured slotFillers view only and
  // skip the children path below.
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const emitChildren = (children: TemplateNode[]): string =>
      emitChildrenJoined(children, ctx);
    const fillerCtx = { ir: ctx.ir, emitChildren };

    const fillerParts: string[] = [];
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) continue; // handled via the snippets prop below
      fillerParts.push(emitSlotFiller(filler, fillerCtx));
    }
    const dyn = emitDynamicSnippetsProp(
      node.slotFillers,
      ctx.ir,
      emitChildren,
    );
    // Dynamic-name dispatch (R5): the prop carries the `snippets={{ [expr]:
    // __rozieDynSlot_<N> }}` map; the snippet identifier blocks live inside
    // the component tag's body alongside the static-name snippet blocks
    // (Svelte 5 evaluates snippet declarations in the surrounding scope and
    // makes them referenceable by identifier).
    const headWithSnippets =
      dyn.prop !== null ? `${head} ${dyn.prop}` : head;
    const allBodyParts = [...fillerParts, ...dyn.snippetBlocks];

    const inner = allBodyParts.join('');
    if (inner.length === 0) {
      return `<${node.tagName}${headWithSnippets}></${node.tagName}>`;
    }
    return `<${node.tagName}${headWithSnippets}>${inner}</${node.tagName}>`;
  }

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${head} />`;
    return `<${node.tagName}${head}></${node.tagName}>`;
  }

  const inner = emitChildrenJoined(node.children, ctx);
  return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
}

/**
 * Recursively scan an AST node for an `Identifier` whose name equals `name`.
 *
 * Used to decide whether a `hoist`-mode match actually needs its temp emitted:
 * core (plan 11-01) classifies a literal-`true` predicate-chain discriminant as
 * `hoist` and allocates a `tempName` — but `foldCaseTest` folds each rung to the
 * BARE predicate, so the temp is never referenced. Emitting the `$derived`
 * declaration anyway would produce a dead, unused rune binding.
 */
function astReferencesIdentifier(node: unknown, name: string): boolean {
  if (node === null || typeof node !== 'object') return false;
  const n = node as { type?: string; name?: string };
  if (n.type === 'Identifier' && n.name === name) return true;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'sourceLoc') continue;
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (astReferencesIdentifier(item, name)) return true;
      }
    } else if (value !== null && typeof value === 'object') {
      if (astReferencesIdentifier(value, name)) return true;
    }
  }
  return false;
}

/** True when at least one folded branch test references the hoist temp. */
function hoistTempIsReferenced(node: TemplateMatchIR): boolean {
  if (node.tempName === undefined) return false;
  const tempName = node.tempName;
  return node.branches.some(
    (b) => b.test !== null && astReferencesIdentifier(b.test, tempName),
  );
}

/**
 * Emit a TemplateMatch (Phase 11 `r-match` / `r-case` / `r-default`).
 *
 * D-02 — pure delegation: the `r-match` construct lowers to a node whose
 * `branches[]` is byte-identical to `TemplateConditionalIR.branches[]`, with
 * the discriminant already folded into each `r-case` test by core (plan 11-01).
 * We construct a synthetic `TemplateConditionalIR` and hand it straight to the
 * existing inline `emitConditional` — no bespoke match emit logic (RESEARCH
 * Open Question 2 recommendation (a)).
 *
 * `discriminantMode === 'hoist'` (D-04 — plan 11-06): an impure
 * `CallExpression` discriminant must be evaluated EXACTLY ONCE per render.
 * Svelte has no `{@const}` precedent, and `{@const}` is legal only INSIDE a
 * Svelte block. The match ladder's first `{#if}` test references the hoist
 * temp — but a `{#if}` test is evaluated BEFORE the block opens, so a
 * `{@const}` placed just inside the `{#if}` cannot supply the very test that
 * gates the block (a chicken-and-egg, RESEARCH Open Question 1). We therefore
 * use the `$derived` script-injection fallback: push a `SvelteScriptInjection`
 * emitting `const <tempName> = $derived(<rewritten-discriminant>);`. `$derived`
 * is a Svelte 5 rune (project floor) — no import needed. The injection lands
 * at `position: 'bottom'` because the discriminant references user `<script>`
 * declarations (e.g. `classify`) that would TDZ if the temp were hoisted above
 * them. The `{#if}` ladder's folded branch tests (`<tempName> === <caseValue>`,
 * pre-folded by core, plan 11-01) then resolve against the `$derived` value.
 * Nested hoisting matches recurse through `emitNode`; the core per-component
 * counter (plan 11-01) guarantees their `tempName`s never collide.
 *
 * r-for LIMITATION: the `$derived` script injection is component-scoped — it
 * is created ONCE and shared across all loop iterations, which is wrong for a
 * per-iteration discriminant. A hoist-mode `r-match` nested inside an `r-for`
 * therefore resolves to one shared `$derived` value for every row. The correct
 * fix inside an `r-for` is a per-iteration `{@const}` taking the loop
 * variables, but the Svelte `EmitNodeCtx` carries no loop-bindings signal to
 * detect that context. Per plan 11-06 we emit the component-scoped `$derived`
 * form unconditionally (correct for the common non-loop case) and record the
 * in-`r-for` gap as a SUMMARY follow-up — Vue's emitter shares this exact gap;
 * React/Solid/Lit (return-position IIFE) and Angular (`@let` inside `@for`)
 * are per-iteration-correct.
 *
 * `hostElement` (real-element `<div r-match>` host): the wrapper element must
 * survive emission. We render the host's tag/attributes via `emitElement` with
 * the `{#if}…{:else if}…{/if}` block spliced in as a single verbatim child —
 * `emitStaticText` passes its `text` through unchanged.
 */
function delegateMatchToConditional(node: TemplateMatchIR, ctx: EmitNodeCtx): string {
  // D-04 hoist: synthesize the `$derived` script injection. Done before the
  // ladder is emitted so the temp is declared in `<script>` and the ladder's
  // folded branch tests resolve. The `hoistTempIsReferenced` guard skips the
  // injection for literal-`true` predicate-chain matches (core marks them
  // `hoist` and allocates a `tempName`, but each rung folds to a bare predicate
  // that never mentions the temp).
  if (
    node.discriminantMode === 'hoist' &&
    node.tempName !== undefined &&
    hoistTempIsReferenced(node)
  ) {
    const rewritten = rewriteTemplateExpression(node.discriminant, ctx.ir);
    ctx.scriptInjections.push({
      name: node.tempName,
      decl: `const ${node.tempName} = $derived(${rewritten});`,
      position: 'bottom',
    });
  }
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  const ladder = emitConditional(synthetic, ctx);
  if (node.hostElement === undefined) {
    return ladder;
  }
  const verbatim: TemplateStaticTextIR = {
    type: 'TemplateStaticText',
    text: ladder,
    sourceLoc: node.hostElement.sourceLoc,
  };
  const hostWithLadder: TemplateElementIR = {
    ...node.hostElement,
    children: [verbatim],
  };
  return emitElement(hostWithLadder, ctx);
}

/**
 * Top-level recursive dispatch over TemplateNode discriminator.
 */
export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  switch (node.type) {
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateInterpolation':
      return emitInterpolation(node, ctx);
    case 'TemplateFragment':
      return emitFragment(node, ctx);
    case 'TemplateConditional':
      return emitConditional(node, ctx);
    case 'TemplateMatch':
      return delegateMatchToConditional(node, ctx);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node as TemplateSlotInvocationIR, {
        ir: ctx.ir,
        emitChildren: (children) => emitChildrenJoined(children, ctx),
      });
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}

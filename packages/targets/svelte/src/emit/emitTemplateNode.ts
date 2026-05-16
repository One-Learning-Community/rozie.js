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
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  Listener,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitAttributes, findRHtml } from './emitTemplateAttribute.js';
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
}

function emitStaticText(node: TemplateStaticTextIR): string {
  // Svelte preserves whitespace inside elements; htmlparser2 already produced
  // clean text. Curly braces in static text would be problematic, but our
  // examples don't include them.
  return node.text;
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ctx: EmitNodeCtx,
): string {
  const expr = rewriteTemplateExpression(node.expression, ctx.ir);
  return `{${expr}}`;
}

function emitFragment(
  node: TemplateFragmentIR,
  ctx: EmitNodeCtx,
): string {
  return node.children.map((c) => emitNode(c, ctx)).join('');
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
    const inner = branch.body.map((c) => emitNode(c, ctx)).join('');
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
  const inner = innerNodes.map((c) => emitNode(c, ctx)).join('');

  return `{#each ${iter} as ${itemDecl}${keySuffix}}${inner}{/each}`;
}

/**
 * Emit element events. Each Listener returns one event-attribute string plus
 * an optional scriptInjection (debounce/throttle wrap).
 *
 * Multiple listeners on the SAME DOM event (e.g., `@keydown.enter="x"` AND
 * `@keydown.escape="y"`) MUST merge into a single `onkeydown={...}` handler
 * — Svelte rejects duplicate attribute names on the same element. We
 * synthesize a single arrow that runs each handler's inlineGuards + body in
 * sequence; the inlineGuards' early-returns (e.g., `if (e.key !== 'Enter')
 * return`) naturally route the event to the correct user handler.
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
      //   `onevent={handler}` (bare identifier) — we wrap as `handler(e);`
      //   `onevent={(e) => { ...body... }}` — we lift the `...body...` out.
      const m = result.eventAttr.match(/^on[a-z]+=\{(.*)\}$/s);
      if (!m) continue;
      const inner = m[1]!;
      // Bare identifier handler:
      if (/^[A-Za-z_$][\w$]*$/.test(inner)) {
        handlerBodies.push(`(() => { ${inner}(e); })();`);
        continue;
      }
      // Arrow shape `(e) => { body }` — extract body.
      const arrowMatch = inner.match(/^\(e\) => \{\s*([\s\S]*?)\s*\}$/);
      if (arrowMatch) {
        handlerBodies.push(`(() => { ${arrowMatch[1]!} })();`);
        continue;
      }
      // Fallback — wrap whatever it is in a callable IIFE.
      handlerBodies.push(`(() => { (${inner})(e); })();`);
    }

    const merged = `on${eventName}={(e) => { ${handlerBodies.join(' ')} }}`;
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
  const attrText = emitAttributes(node.attributes, { ir: ctx.ir });
  const eventText = emitEvents(node.events, ctx);
  const rHtml = findRHtml(node.attributes);

  const partsHead: string[] = [];
  if (attrText) partsHead.push(attrText);
  if (eventText) partsHead.push(eventText);
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
      children.map((c) => emitNode(c, ctx)).join('');
    const fillerCtx = { ir: ctx.ir, emitChildren };

    const fillerParts: string[] = [];
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) continue; // handled via the snippets prop below
      fillerParts.push(emitSlotFiller(filler, fillerCtx));
    }
    const dynSnippetsProp = emitDynamicSnippetsProp(
      node.slotFillers,
      ctx.ir,
      emitChildren,
    );
    const headWithSnippets =
      dynSnippetsProp !== null
        ? `${head} ${dynSnippetsProp}`
        : head;

    const inner = fillerParts.join('');
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

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
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
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node as TemplateSlotInvocationIR, {
        ir: ctx.ir,
        emitChildren: (children) => children.map((c) => emitNode(c, ctx)).join(''),
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

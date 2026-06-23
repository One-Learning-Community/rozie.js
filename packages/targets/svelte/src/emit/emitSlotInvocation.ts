/**
 * emitSlotInvocation — Phase 5 Plan 02a Task 2.
 *
 * Lowers a `TemplateSlotInvocationIR` into Svelte 5 markup per RESEARCH
 * Pattern 3 + OQ A1 RESOLVED:
 *
 *   - presence='always' AND no defaultContent (and no fallback inline)
 *       → bare shorthand: `{@render slotName?.(args)}`
 *   - presence='conditional' AND no defaultContent
 *       → `{#if slotName}{@render slotName(args)}{/if}`
 *   - defaultContent OR fallback present (regardless of presence)
 *       → A1 RESOLVED verbose form:
 *         `{#if slotName}{@render slotName(args)}{:else}<fallback />{/if}`
 *
 * Default slot (slotName === '') keys as `children` per Svelte 5 magic-prop
 * convention (RESEARCH Pattern 3).
 *
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *
 *   When `node.context === 'fill-body'` (sticky-downward flag set by the
 *   lowerer in Plan 07.2-01 for any <slot> nested inside a SlotFillerDecl.body),
 *   this emitter requires NO branch. The producer-side `{@render <X>?.(args)}`
 *   shape IS the correct re-projection shape because `<X>` resolves against
 *   the wrapper's OWN snippet props (the wrapper is being compiled as a
 *   complete component, with its own `let { title }: Props = $props()`
 *   destructure). When a wrapper re-projects its consumer's `title` snippet
 *   into Inner's `header` slot via
 *   `<Inner><template #header><slot name="title"/></template></Inner>`,
 *   the emitted Svelte reads `{@render title?.()}` — the wrapper's OWN title
 *   snippet prop, which is its incoming snippet from its consumer.
 *
 *   D-07 wrapper-only-params semantics are honored by construction: the emit
 *   for `<slot name="title" />` references ONLY `title`, never the enclosing
 *   fill body's scoped params (e.g., `close` from `<template #header="{ close }">`).
 *
 *   No parent-chain walking is needed (D-SM-01 anti-pattern avoided).
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateSlotInvocationIR,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { findRForSlotNameCollisions } from '../../../../core/src/ir/findRForSlotNameCollisions.js';

export interface EmitSlotInvocationCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fallback children. */
  emitChildren: (children: TemplateNode[]) => string;
}

/**
 * Render a single slot invocation site (`<slot name="x" :prop="..." />`)
 * as Svelte 5 markup using {@render} + optional {#if/:else/{/if} wrap.
 *
 * Example outputs:
 *   - default, no fallback:        `{@render children?.()}`
 *   - named 'trigger' with args:   `{@render trigger?.(open, toggle)}`
 *   - named 'header' with default: `{#if header}{@render header(remaining, total)}{:else}<h3>...</h3>{/if}`
 */
export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitSlotInvocationCtx,
): string {
  // Portal-slot primitive (Spike 003) — skip template emit. Portal slots are
  // mount()ed into foreign engine containers from the wrapper's script via
  // `$portals.<name>(...)`.
  if (node.isPortal) return '';
  const slotKey = node.slotName === '' ? 'children' : node.slotName;

  // r-for-loop-var == slot-name collision auto-fix (lockstep with emitScript's
  // emitSlotDerivedMerges binding rename): when this slot's name is shadowed by
  // an enclosing `r-for` loop var, render the safe suffixed snippet binding
  // (`X$$slot`) instead of the bare `X` — inside the compiled `{#each … as X}`
  // the bare `X` resolves to the loop ITEM (a non-function) → runtime crash on
  // Svelte only. Conditional: only colliding slots are renamed, so non-colliding
  // components emit byte-identical Svelte (supersedes the retired ROZ980 warning).
  const renderName = findRForSlotNameCollisions(ctx.ir).has(node.slotName)
    ? `${node.slotName}$$slot`
    : slotKey;

  // Build object-shape arg payload per Phase 07.3.1 Blocker #2 D-02. Svelte's
  // snippet invocation is positional in syntax but Rozie's cross-target
  // contract uses object-payload destructure on the consumer side; producer
  // must emit a single object to match. Shorthand collapse (`{ close }` for
  // `close: close`) keeps the output idiomatic.
  const argList =
    node.args.length === 0
      ? ''
      : `{ ${node.args
          .map((a) => {
            const key = a.name;
            const expr = rewriteTemplateExpression(a.expression, ctx.ir);
            return key === expr ? key : `${key}: ${expr}`;
          })
          .join(', ')} }`;

  // Find matching SlotDecl to determine presence + defaultContent.
  const decl: SlotDecl | undefined = ctx.ir.slots.find(
    (s) => (s.name === '' ? '' : s.name) === node.slotName,
  );

  // Determine the fallback content: defaultContent from SlotDecl takes
  // priority; falls back to the inline fallback children on the invocation
  // node (Phase 1's parser preserves the <slot>'s children as `node.fallback`).
  const fallbackChildren: TemplateNode[] =
    decl?.defaultContent !== null && decl?.defaultContent !== undefined
      ? [decl.defaultContent]
      : node.fallback;

  const hasFallback = fallbackChildren.length > 0;
  const presence: 'always' | 'conditional' = decl?.presence ?? 'always';

  if (!hasFallback && presence === 'always') {
    // Bare shorthand. The `?.` makes it safe when the consumer didn't provide
    // a snippet for this slot.
    return `{@render ${renderName}?.(${argList})}`;
  }

  if (!hasFallback && presence === 'conditional') {
    // Conditional wrap (no fallback to render).
    return `{#if ${renderName}}{@render ${renderName}(${argList})}{/if}`;
  }

  // Has fallback — A1 RESOLVED verbose form.
  const fallbackMarkup = ctx.emitChildren(fallbackChildren);
  return `{#if ${renderName}}{@render ${renderName}(${argList})}{:else}${fallbackMarkup}{/if}`;
}

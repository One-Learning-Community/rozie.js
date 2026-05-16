/**
 * emitSlotFiller — Phase 07.2 Plan 02 Task 3 (Svelte target).
 *
 * Consumer-side mirror of emitSlotInvocation (producer side). Where the
 * producer emits `{@render header?.(close)}` reads, the consumer emits the
 * matching `{#snippet header({ close })}…body…{/snippet}` BLOCK inside the
 * component tag.
 *
 * Slot-key mapping (mirrors producer-side emitSlotInvocation.ts L47):
 *   - '' (default) → 'children'  (Svelte 5 magic-prop convention)
 *   - 'header'     → 'header'   (verbatim)
 *
 * Output shapes (per RESEARCH §"Pattern 3.c Svelte 5"):
 *
 *   { name: 'header', params: [] }
 *     → `{#snippet header()}…body…{/snippet}`
 *
 *   { name: 'header', params: [{name:'close'}] }
 *     → `{#snippet header({ close })}…body…{/snippet}`
 *
 *   { name: '', params: [] }                            (default-shorthand)
 *     → bare children inside the component tag (Svelte 5 implicit `children`
 *       snippet). No {#snippet} block needed for the no-param default form.
 *
 *   { name: '', params: [{name:'item'}] }              (scoped default)
 *     → `{#snippet children({ item })}…body…{/snippet}`
 *       ↑ explicit snippet form when scoped — bare children can't carry
 *         params in Svelte 5.
 *
 *   { isDynamic: true, dynamicNameExpr } — R5 dynamic name
 *     → emit a `snippets={{ [expr]: ... }}` prop fragment (RESEARCH §3.c
 *       "Dynamic name D-04 Svelte"). The current Wave-1 consumer-named-fill
 *       fixture has no dynamic names; the dynamic branch ships now so
 *       emitTemplateNode dispatches symmetrically with vue/react. Wave 2
 *       fixtures exercise the full round-trip.
 *
 * Body recursion uses the parent emitNode pipeline — magic-identifier
 * rewrites (`$props.x` → `x`, `$data.x` → `x`, etc.) apply naturally via
 * `rewriteTemplateExpression` on any TemplateInterpolation nested inside
 * the fill body. No separate rewrite pass needed.
 *
 * Phase 07.1 self-reference pattern: SlotFillerDecl is imported via the
 * `@rozie/core` package specifier, NOT the deep ../../../core/src/ir/types.js
 * relative path that would reintroduce the cross-package `.d.ts` identity
 * bug Phase 07.1 fixed.
 *
 * @experimental — shape may change before v1.0
 */
// Per Phase 07.1 self-reference pattern, SlotFillerDecl + IRComponent come
// from the `@rozie/core` barrel. The barrel re-exports the IR-side
// TemplateNode under the name `IRTemplateNode` (the bare `TemplateNode`
// barrel export refers to the AST-side TemplateNode for parser consumers).
// We need the IR-side type here, so alias on the way in.
import type {
  SlotFillerDecl,
  IRComponent,
  IRTemplateNode as TemplateNode,
} from '@rozie/core';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

/**
 * Slot-key mapping. Mirrors producer-side emitSlotInvocation.ts L47.
 */
function snippetKey(slotName: string): string {
  return slotName === '' ? 'children' : slotName;
}

/**
 * Render the snippet-arg destructure for a scoped fill.
 *   - []                → ''             (snippet takes no args)
 *   - [{name:'close'}]  → '{ close }'
 *   - [{name:'a'},{name:'b'}]
 *                       → '{ a, b }'
 */
function paramsDestructure(filler: SlotFillerDecl): string {
  if (filler.params.length === 0) return '';
  return `{ ${filler.params.map((p) => p.name).join(', ')} }`;
}

/**
 * Context shape this module needs. Mirrors the producer-side
 * EmitSlotInvocationCtx pattern — we accept a recursive emitChildren callback
 * so we don't have to import emitNode here (which would create a static
 * cycle with emitTemplateNode that imports this module).
 */
export interface EmitSlotFillerCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fill bodies. */
  emitChildren: (children: TemplateNode[]) => string;
}

/**
 * Format ONE static-named filler (or default-shorthand) as a single Svelte 5
 * markup string suitable for inclusion as a CHILD of the component tag.
 *
 * Default-shorthand without params returns bare children (no {#snippet}
 * wrapper). All other forms return a `{#snippet key(args)}…{/snippet}` block.
 */
export function emitSlotFiller(
  filler: SlotFillerDecl,
  ctx: EmitSlotFillerCtx,
): string {
  const bodyMarkup = ctx.emitChildren(filler.body);

  // Default-shorthand without params: bare children inside the component
  // tag. Svelte 5's implicit `children` snippet picks them up.
  if (!filler.isDynamic && filler.name === '' && filler.params.length === 0) {
    return bodyMarkup;
  }

  // All other cases: emit a {#snippet} block.
  const key = snippetKey(filler.name);
  const destructure = paramsDestructure(filler);
  const argList = destructure === '' ? '()' : `(${destructure})`;
  return `{#snippet ${key}${argList}}${bodyMarkup}{/snippet}`;
}

/**
 * R5 dynamic-name path — collect ALL dynamic fillers on a single component
 * tag into one `snippets={{ [expr]: __rozieDynSlot_<N>, … }}` prop +
 * matching `{#snippet __rozieDynSlot_<N>(...)}…{/snippet}` body blocks.
 *
 * Returns `{ prop: null, snippetBlocks: [] }` when no dynamic fillers are
 * present. Otherwise returns:
 *   - `prop`: the `snippets={{ … }}` attribute string for the component tag's
 *     head (caller appends after the existing `head` text).
 *   - `snippetBlocks`: one `{#snippet __rozieDynSlot_<N>(args)}body{/snippet}`
 *     per dynamic filler — caller emits them inside the component tag's
 *     children alongside the static-name snippet blocks from `emitSlotFiller`.
 *
 * Per D-04 Svelte: Svelte 5's snippet primitive is declarative inside the
 * template — you cannot synthesise an inline `(args) => snippet(args)` JS
 * value for a `snippets={{…}}` map directly. The standard idiom is to
 * declare a `{#snippet name(args)}body{/snippet}` block by identifier and
 * reference that identifier in the map. We adopt that idiom here: each
 * dynamic filler becomes a sibling snippet block keyed by a deterministic
 * synthetic name (`__rozieDynSlot_<index>`); the snippets prop carries the
 * `[<rewritten expression>]: __rozieDynSlot_<index>` entry.
 *
 * Silent fallback on runtime miss (D-05): the producer-side Svelte 5
 * `{@render header?.(…)}` already short-circuits on undefined. When the
 * dynamic key doesn't match any producer slot, the projection silently
 * no-ops and the producer's defaultContent renders.
 *
 * Index counter is local to the per-component-tag invocation — synthesised
 * names won't collide across siblings because each component-tag's emit
 * runs the helper independently.
 */
export function emitDynamicSnippetsProp(
  fillers: readonly SlotFillerDecl[],
  ir: IRComponent,
  emitChildren: (children: TemplateNode[]) => string,
): { prop: string | null; snippetBlocks: string[] } {
  void ir; // kept in signature for future use (e.g. expression-source diagnostics)
  const dynamics = fillers.filter((f) => f.isDynamic);
  if (dynamics.length === 0) return { prop: null, snippetBlocks: [] };

  const entries: string[] = [];
  const snippetBlocks: string[] = [];
  let idx = 0;
  for (const filler of dynamics) {
    if (!filler.dynamicNameExpr) continue; // ROZ946 emitted upstream
    const snippetName = `__rozieDynSlot_${idx}`;
    const keyExpr = rewriteTemplateExpression(filler.dynamicNameExpr, ir);
    const destructure = paramsDestructure(filler);
    const argList = destructure === '' ? '()' : `(${destructure})`;
    const body = emitChildren(filler.body);
    snippetBlocks.push(`{#snippet ${snippetName}${argList}}${body}{/snippet}`);
    entries.push(`[${keyExpr}]: ${snippetName}`);
    idx++;
  }
  if (entries.length === 0) return { prop: null, snippetBlocks: [] };
  return {
    prop: `snippets={{ ${entries.join(', ')} }}`,
    snippetBlocks,
  };
}

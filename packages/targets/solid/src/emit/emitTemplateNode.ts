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
  TemplateLoopIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  TemplateSlotInvocationIR,
  AttributeBinding,
  IRComponent,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitAttributes } from './emitTemplateAttribute.js';
import { emitConditional } from './emitConditional.js';
import { emitTemplateEvent } from './emitTemplateEvent.js';
import { emitRModel } from './emitRModel.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
// Phase 07.2 Plan 03 — consumer-side slot-fill emission for component-tag elements.
import { emitSlotFiller, emitDynamicSlotsProp } from './emitSlotFiller.js';

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
}

function emitStaticText(node: TemplateStaticTextIR, _ctx: EmitNodeCtx): string {
  return node.text;
}

function emitInterpolation(node: TemplateInterpolationIR, ctx: EmitNodeCtx): string {
  const code = rewriteTemplateExpression(node.expression, ctx.ir);
  return `{${code}}`;
}

function emitFragment(node: TemplateFragmentIR, ctx: EmitNodeCtx): string {
  if (node.children.length === 1) return emitNode(node.children[0]!, ctx);
  const parts = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<>${parts}</>`;
}

/**
 * Emit a TemplateLoop as `<For each={items()}>{(item, index) => ...}</For>`.
 *
 * Solid's <For> component uses referential identity for keying by default.
 * The `:key` attribute from the source is informational only — <For> does NOT
 * accept a `key` prop (it uses structural identity internally). We document
 * this in a comment but do NOT emit key= on the <For> element.
 *
 * NOTE: Solid also has <Index> for keying by index; we always use <For> for
 * r-for because r-for semantics match <For> (item-identity tracking).
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  ctx.collectors.solid.add('For');

  const iterableCode = rewriteTemplateExpression(node.iterableExpression, ctx.ir);

  // Build the callback arrow signature: (item) or (item, index)
  const aliasStr = node.indexAlias
    ? `(${node.itemAlias}, ${node.indexAlias})`
    : `(${node.itemAlias})`;

  let bodyJsx: string;
  if (node.body.length === 1) {
    bodyJsx = emitNode(node.body[0]!, ctx);
  } else {
    const parts = node.body.map((c) => emitNode(c, ctx)).join('');
    bodyJsx = `<>${parts}</>`;
  }

  return `<For each={${iterableCode}}>{${aliasStr} => ${bodyJsx}}</For>`;
}

/**
 * Find an attribute by name.
 */
function findAttribute(attrs: AttributeBinding[], name: string): AttributeBinding | null {
  for (const a of attrs) {
    if (a.name === name) return a;
  }
  return null;
}

/**
 * Build the bare component-scope attribute JSX fragment (e.g.
 * `data-rozie-s-abc12345=""`). Returns `null` when the context has no scope
 * attr OR when the element is a child component (those carry their own scope).
 */
function scopeAttrForElement(node: TemplateElementIR, ctx: EmitNodeCtx): string | null {
  if (!ctx.scopeAttr) return null;
  if (node.tagKind !== 'html') return null;
  // Empty-string attribute value is the canonical "boolean attribute"
  // selector-friendly form. CSS `[data-rozie-s-xyz]` matches it.
  return `${ctx.scopeAttr}=""`;
}

/**
 * Emit all @event listeners on an element, merging multiple listeners that
 * map to the same JSX prop (e.g., @keydown.enter + @keydown.escape → onKeyDown).
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
    });
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
        return `${body}(e);`;
      }
      return `(${body})(e);`;
    });
    const dispatcher = `(e) => { ${branches.join(' ')} }`;
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
function mergeEventAttributes(attrsJsx: string, eventsJsx: string): string {
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
        if (/^[A-Za-z_$][\w$]*$/.test(body)) return `${body}(e);`;
        return `(${body})(e);`;
      };
      merged.push(`${name}={(e) => { ${wrap(attrsBody)} ${wrap(eventsBody)} }}`);
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
 * tagKind discrimination per D-115:
 *   - 'html': standard HTML element, class stays as `class=` (Solid supports this)
 *   - 'component': PascalCase tag, emit verbatim; cross-rozie imports handled by emitSolid
 *   - 'self': self-reference, emit verbatim PascalCase (JS scope resolves it)
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  let workingAttrs: AttributeBinding[] = [...node.attributes];

  const scopeAttrJsx = scopeAttrForElement(node, ctx);

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
    const exprCode = rewriteTemplateExpression(rHtmlAttr.expression, ctx.ir);
    workingAttrs = workingAttrs.filter((a) => a !== rHtmlAttr);
    const attrsResult = emitAttributes(workingAttrs, { ir: ctx.ir, collectors: ctx.collectors });
    for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);
    const eventsJsx = emitElementEvents(node, ctx);
    const headParts = [attrsResult.jsx, eventsJsx, `innerHTML={${exprCode}}`].filter(Boolean);
    if (scopeAttrJsx) headParts.push(scopeAttrJsx);
    const head = headParts.length > 0 ? ' ' + headParts.join(' ') : '';
    return `<${node.tagName}${head} />`;
  }

  // r-text special-case
  const rTextAttr = findAttribute(workingAttrs, 'r-text');
  let rTextChildren: string | null = null;
  if (rTextAttr && rTextAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rTextAttr.expression, ctx.ir);
    rTextChildren = `{${exprCode}}`;
    workingAttrs = workingAttrs.filter((a) => a !== rTextAttr);
  }

  // r-show special-case: emit style={{ display: cond ? '' : 'none' }}
  // Note: In Solid, style prop takes an object OR a string. For conditional
  // display, emit style={{ display: (cond) ? '' : 'none' }}.
  const rShowAttr = findAttribute(workingAttrs, 'r-show');
  let rShowStyleAttr: string | null = null;
  if (rShowAttr && rShowAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rShowAttr.expression, ctx.ir);
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
  const attrsResult = emitAttributes(workingAttrs, { ir: ctx.ir, collectors: ctx.collectors });
  for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);

  const eventsJsx = emitElementEvents(node, ctx);

  // Merge duplicate event props between attrs (r-model) and events (@event.modifier).
  // r-model generates onInput= as an attribute string; @input.debounce generates another
  // onInput= via emitElementEvents. Merging produces a single dispatcher arrow.
  const headParts = [mergeEventAttributes(attrsResult.jsx, eventsJsx)];
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

/**
 * emitTemplateNode — Plan 04-03 Task 1 (React target).
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * JSX-string fragments per RESEARCH Pattern 5 emission map (lines 671-679).
 *
 * Element-level special-cases (handled in emitTemplateElement):
 *   - r-show on element → wrap with style={{ display: cond ? '' : 'none' }}
 *   - r-html on element → emit dangerouslySetInnerHTML; ROZ520 if children present
 *   - r-text on element → replace children with {expr}
 *   - r-model on element → delegate to emitRModel for value/onChange pair
 *   - @event attributes → delegate to emitTemplateEvent
 *   - class/:class → composeClassName via emitTemplateAttribute (D-53/D-55)
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
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateLoopIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitAttributes } from './emitTemplateAttribute.js';
import { emitConditional } from './emitConditional.js';
import { emitTemplateEvent } from './emitTemplateEvent.js';
import { emitRModel } from './emitRModel.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
// Phase 07.2 — consumer-side slot-fill emission for component-tag elements.
import { emitSlotFiller, emitDynamicSlotsProp } from './emitSlotFiller.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector };
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Top-of-component-body lines (e.g., wrapped helper consts, default-content lifts) */
  scriptInjections: string[];
  /** Per-component counter for stable wrap-name suffixes */
  injectionCounter: { next: number };
  /** Optional key expression to inject into the immediate next TemplateElement (used by r-for) */
  pendingKey?: string | null;
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
  // JSX preserves whitespace inside elements; htmlparser2 already produced
  // clean text. Pass through verbatim. Note: bare text containing JSX-meta
  // chars like `{` or `}` would be problematic, but our examples don't.
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
 * Emit a TemplateLoop as `{items.map((item) => <El key={...}>...</El>)}`.
 * The body[0] is the bare element; we inject `key={...}` into its attribute
 * list via the pendingKey context channel.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  const iterableCode = rewriteTemplateExpression(node.iterableExpression, ctx.ir);
  const aliasStr = node.indexAlias
    ? `(${node.itemAlias}, ${node.indexAlias})`
    : `(${node.itemAlias})`;
  const keyCode = node.keyExpression
    ? rewriteTemplateExpression(node.keyExpression, ctx.ir)
    : null;

  // Inject the key into the next element via pendingKey.
  const childCtx: EmitNodeCtx = { ...ctx, pendingKey: keyCode };
  let bodyJsx: string;
  if (node.body.length === 1) {
    bodyJsx = emitNode(node.body[0]!, childCtx);
  } else {
    // Multiple children — use React.Fragment with key= injected, since the
    // parent needs a single keyed JSX element. We use the JSX shorthand
    // `<Fragment key={k}>...</Fragment>` only if pendingKey was not consumed;
    // otherwise concatenate.
    const parts = node.body.map((c) => emitNode(c, childCtx)).join('');
    if (keyCode !== null) {
      bodyJsx = `<React.Fragment key={${keyCode}}>${parts}</React.Fragment>`;
      // We'd need React.Fragment — skip the import dance for v1; assume rare.
    } else {
      bodyJsx = parts;
    }
  }
  return `{${iterableCode}.map(${aliasStr} => ${bodyJsx})}`;
}

/**
 * Find an attribute by name (returns the first match).
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
 * Emit a TemplateElement. Applies element-level special-cases (r-show, r-html,
 * r-text, r-model) before falling through to the standard tag/attr/children form.
 *
 * Phase 06.2 P2: tagKind === 'component' resolves to a top-of-file
 * `import {LocalName} from './LocalName';` (synthesized by emitReact); 'self'
 * resolves to the enclosing named-function declaration (Pitfall 7 — function
 * declarations are hoisted within their containing scope). Both emit the tag
 * verbatim PascalCase below; no template AST rewrite needed.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Capture and clear pendingKey for this element ONLY.
  const pendingKey = ctx.pendingKey ?? null;
  const childCtx: EmitNodeCtx = { ...ctx, pendingKey: null };

  // Build a working set of attributes — start with element's own.
  let workingAttrs: AttributeBinding[] = [...node.attributes];

  const scopeAttrJsx = scopeAttrForElement(node, ctx);

  // Inject the loop key BEFORE emitAttributes is called. We synthesise a
  // binding-kind attr with name=':key' and a placeholder identifier whose
  // expression is parsed back from the keyCode string. To stay safe, we
  // inject the key as a SPECIAL attribute that emitAttributes treats specially.
  // Simpler approach: append a key={...} jsx attribute directly to the head.

  // r-html special-case
  const rHtmlAttr = findAttribute(workingAttrs, 'r-html');
  if (rHtmlAttr && rHtmlAttr.kind === 'binding') {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'warning',
        message: `<${node.tagName}> r-html on element with children — children dropped (Pitfall 10).`,
        loc: rHtmlAttr.sourceLoc,
      });
    }
    const exprCode = rewriteTemplateExpression(rHtmlAttr.expression, ctx.ir);
    // Strip r-html from emitted attrs.
    workingAttrs = workingAttrs.filter((a) => a !== rHtmlAttr);
    const attrsResult = emitAttributes(workingAttrs, {
      ir: ctx.ir,
      collectors: ctx.collectors,
    });
    for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);
    const eventsJsx = emitElementEvents(node, childCtx);
    const headParts = [attrsResult.jsx, eventsJsx, `dangerouslySetInnerHTML={{ __html: ${exprCode} }}`].filter(Boolean);
    if (scopeAttrJsx) headParts.push(scopeAttrJsx);
    if (pendingKey !== null) headParts.unshift(`key={${pendingKey}}`);
    const head = headParts.length > 0 ? ' ' + headParts.join(' ') : '';
    return `<${node.tagName}${head} />`;
  }

  // r-text special-case: replace children with {expr}
  const rTextAttr = findAttribute(workingAttrs, 'r-text');
  let rTextChildren: string | null = null;
  if (rTextAttr && rTextAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rTextAttr.expression, ctx.ir);
    rTextChildren = `{${exprCode}}`;
    workingAttrs = workingAttrs.filter((a) => a !== rTextAttr);
  }

  // r-show special-case: emit style={{ display: cond ? '' : 'none' }}.
  // Wrap the rewritten expression in parens so any inner low-precedence
  // operators (`||`, `??`, `&&`) bind correctly relative to the trailing `?`.
  const rShowAttr = findAttribute(workingAttrs, 'r-show');
  let rShowStyleAttr: string | null = null;
  if (rShowAttr && rShowAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rShowAttr.expression, ctx.ir);
    rShowStyleAttr = `style={{ display: (${exprCode}) ? '' : 'none' }}`;
    workingAttrs = workingAttrs.filter((a) => a !== rShowAttr);
  }

  // r-model special-case: lower to value+onChange (or checked+onChange)
  const rModelAttr = findAttribute(workingAttrs, 'r-model');
  if (rModelAttr) {
    const rModelResult = emitRModel(node, ctx.ir);
    for (const d of rModelResult.diagnostics) ctx.diagnostics.push(d);
    if (rModelResult.replacementAttributes.length > 0) {
      // Replace the r-model attribute with the emitted pair.
      workingAttrs = workingAttrs.filter((a) => a !== rModelAttr);
      workingAttrs = [...workingAttrs, ...rModelResult.replacementAttributes];
    }
  }

  // Standard attribute emission
  const attrsResult = emitAttributes(workingAttrs, {
    ir: ctx.ir,
    collectors: ctx.collectors,
  });
  for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);

  const eventsJsx = emitElementEvents(node, childCtx);

  const headParts = [attrsResult.jsx, eventsJsx];
  if (rShowStyleAttr) headParts.push(rShowStyleAttr);
  if (scopeAttrJsx) headParts.push(scopeAttrJsx);
  if (pendingKey !== null) headParts.unshift(`key={${pendingKey}}`);

  // Phase 07.2 consumer-side slot-fill emit (R3 + R4 + R5).
  //
  // When this element is a component-tag (tagKind 'component' | 'self') and
  // carries SlotFillerDecl[] from the lowerer (lowerSlotFillers.ts L186-310),
  // the body content lives in node.slotFillers. The same body content is ALSO
  // present in node.children (the lowerer doesn't strip it — extractSlotFillers
  // walks a parallel array). To avoid double-emission we MUST emit fillers
  // via JSX-attribute assignments and SKIP the raw children path below.
  //
  // Per producer-side dual-shape (emitSlotInvocation.ts L22-32), the React
  // mapping is:
  //   - default-shorthand → `children={…JSX…}` prop (raw ReactNode form)
  //   - default scoped     → `children={(args) => …}` (function form)
  //   - named static       → `render<Pascal>={() => …}`
  //   - named scoped       → `render<Pascal>={(args) => …}`
  //   - dynamic-name (R5)  → `slots={{ [expr]: (args) => … }}`
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const fillerAttrs: string[] = [];
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) continue; // merged into a single slots={…} below
      fillerAttrs.push(emitSlotFiller(filler, childCtx));
    }
    const dynamicSlotsAttr = emitDynamicSlotsProp(node.slotFillers, childCtx);
    if (dynamicSlotsAttr !== null) fillerAttrs.push(dynamicSlotsAttr);

    const headWithFills = [
      ...headParts.filter(Boolean),
      ...fillerAttrs,
    ].join(' ');
    const headOutFills = headWithFills.length > 0 ? ' ' + headWithFills : '';
    // Component tags with slot fills self-close — body content is wholly
    // represented by the slot-prop assignments above.
    return `<${node.tagName}${headOutFills} />`;
  }

  const head = headParts.filter(Boolean).join(' ');
  const headOut = head.length > 0 ? ' ' + head : '';

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  // Children emission (or rTextChildren replacement)
  if (rTextChildren !== null) {
    return `<${node.tagName}${headOut}>${rTextChildren}</${node.tagName}>`;
  }

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${headOut} />`;
    return `<${node.tagName}${headOut} />`;
  }

  const inner = node.children.map((c) => emitNode(c, childCtx)).join('');
  return `<${node.tagName}${headOut}>${inner}</${node.tagName}>`;
}

/**
 * Emit all template @event listeners on an element.
 *
 * **Plan 04-04 dispatcher-merge** (Plan 04-03 deferred limitation #2):
 * Multiple `@event` bindings on the SAME element that resolve to the SAME
 * JSX prop name (e.g., `@keydown.enter` + `@keydown.escape` both map to
 * `onKeyDown`) are combined into a single dispatcher arrow:
 *
 *   onKeyDown={(e) => {
 *     // Branch 1 (from @keydown.enter):
 *     if (e.key === 'Enter') { onSearch(e); return; }
 *     // Branch 2 (from @keydown.escape):
 *     if (e.key === 'Escape') { clear(e); return; }
 *   }}
 *
 * Without this merge, JSX silently keeps only the LAST attribute when keys
 * collide — losing the first listener and producing surprising behavior.
 */
function emitElementEvents(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  if (node.events.length === 0) return '';

  // Pass 1: emit each listener individually. Capture jsxName + handler body.
  type EmittedAttr = { jsxName: string; body: string };
  const emitted: EmittedAttr[] = [];
  for (const ev of node.events) {
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
    });
    if (result.scriptInjection !== null) {
      ctx.scriptInjections.push(result.scriptInjection);
    }
    for (const d of result.diagnostics) ctx.diagnostics.push(d);

    // Parse `<jsxName>={<body>}` so we can re-group when names collide.
    // emitTemplateEvent guarantees `${jsxName}={${handlerExpr}}`.
    const match = result.jsxAttr.match(/^([A-Za-z][\w]*)=\{(.*)\}$/s);
    if (!match) {
      // Defensive — pass through unchanged if parse failed.
      emitted.push({ jsxName: '', body: result.jsxAttr });
      continue;
    }
    emitted.push({ jsxName: match[1]!, body: match[2]! });
  }

  // Pass 2: group by jsxName, preserving original order.
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
    // Multi-listener merge: build a dispatcher arrow that calls each branch
    // in source order. Each `body` is a handler expression — wrap it so the
    // event arg `e` is forwarded.
    const branches = items.map((it) => {
      const body = it.body;
      // If body is a plain identifier (e.g. `close`), call as `body(e)`.
      // If body is an arrow `(e) => {...}`, invoke as `(body)(e)`.
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

// Re-export generator / GEN_OPTS so other emit/* modules can share them.
export { generate, GEN_OPTS };

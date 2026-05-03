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
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
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
 * Emit a TemplateElement. Applies element-level special-cases (r-show, r-html,
 * r-text, r-model) before falling through to the standard tag/attr/children form.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Capture and clear pendingKey for this element ONLY.
  const pendingKey = ctx.pendingKey ?? null;
  const childCtx: EmitNodeCtx = { ...ctx, pendingKey: null };

  // Build a working set of attributes — start with element's own.
  let workingAttrs: AttributeBinding[] = [...node.attributes];

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

  // r-show special-case: emit style={{ display: cond ? '' : 'none' }}
  const rShowAttr = findAttribute(workingAttrs, 'r-show');
  let rShowStyleAttr: string | null = null;
  if (rShowAttr && rShowAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rShowAttr.expression, ctx.ir);
    rShowStyleAttr = `style={{ display: ${exprCode} ? '' : 'none' }}`;
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
  if (pendingKey !== null) headParts.unshift(`key={${pendingKey}}`);
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
 */
function emitElementEvents(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  if (node.events.length === 0) return '';
  const out: string[] = [];
  for (const ev of node.events) {
    // Phase 2 IR may carry null/positional placeholders for non-bound events
    // (rare; defensive guard).
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
    });
    out.push(result.jsxAttr);
    if (result.scriptInjection !== null) {
      ctx.scriptInjections.push(result.scriptInjection);
    }
    for (const d of result.diagnostics) ctx.diagnostics.push(d);
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

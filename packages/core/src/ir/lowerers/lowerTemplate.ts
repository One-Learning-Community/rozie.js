/**
 * lowerTemplate — convert TemplateAST to TemplateNode IR tree + Listener[]
 * (template-event sourced).
 *
 * Plan 02-05 Task 2.
 *
 * Produces:
 *   - A recursive TemplateNode tree (Element / Conditional / Loop /
 *     SlotInvocation / Fragment / Interpolation / StaticText)
 *   - A flat list of template-event Listener IRs (for IRComponent.listeners[],
 *     SAME shape as <listeners>-block entries — D-20).
 *
 * Sibling r-if / r-else-if / r-else groups merge into ONE TemplateConditionalIR.
 *
 * Per D-08 collected-not-thrown: never throws. Expression parse failures push
 * empty deps; modifier resolution failures push diagnostics (delegated to
 * resolveModifierPipeline).
 *
 * @experimental — shape may change before v1.0
 */
import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import type {
  TemplateAST,
  TemplateNode as ASTTemplateNode,
  TemplateElement as ASTTemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { BindingsTable } from '../../semantic/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { ReactiveDepGraph } from '../../reactivity/ReactiveDepGraph.js';
import type {
  ModifierRegistry,
  ModifierContext,
} from '../../modifiers/ModifierRegistry.js';
import { extractRForAliases } from '../../semantic/extractRForAliases.js';
import { computeExpressionDeps } from '../../reactivity/computeDeps.js';
import { resolveModifierPipeline } from './lowerListeners.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  AttributeBinding,
  Listener,
} from '../types.js';

export interface LowerTemplateResult {
  template: IRTemplateNode | null;
  templateListeners: Listener[];
}

/**
 * Helper: try to parse an expression text via @babel/parser. Returns null on
 * failure (D-08 — parser layer already emitted ROZ051).
 */
function tryParseExpression(text: string): t.Expression | null {
  try {
    return parseExpression(text, { sourceType: 'module' });
  } catch {
    return null;
  }
}

/**
 * Detect mustache interpolation `{{ ... }}` inside an attribute value. Returns
 * the parsed segments if any, otherwise null.
 */
function parseInterpolatedSegments(
  rawValue: string,
  bindings: BindingsTable,
): AttributeBinding | null {
  // Cheap pre-test: does the value contain '{{' ?
  if (!rawValue.includes('{{')) return null;

  const segments: Array<
    | { kind: 'static'; text: string }
    | { kind: 'binding'; expression: t.Expression; deps: ReturnType<typeof computeExpressionDeps> }
  > = [];

  let cursor = 0;
  while (cursor < rawValue.length) {
    const open = rawValue.indexOf('{{', cursor);
    if (open === -1) {
      const tail = rawValue.slice(cursor);
      if (tail.length > 0) segments.push({ kind: 'static', text: tail });
      break;
    }
    if (open > cursor) {
      segments.push({ kind: 'static', text: rawValue.slice(cursor, open) });
    }
    const close = rawValue.indexOf('}}', open + 2);
    if (close === -1) {
      // Unterminated — append the rest as static and bail.
      segments.push({ kind: 'static', text: rawValue.slice(open) });
      break;
    }
    const exprText = rawValue.slice(open + 2, close).trim();
    const parsed = tryParseExpression(exprText);
    if (parsed) {
      segments.push({
        kind: 'binding',
        expression: parsed,
        deps: computeExpressionDeps(parsed, bindings),
      });
    } else {
      // Could not parse — preserve as literal-text segment
      segments.push({ kind: 'static', text: rawValue.slice(open, close + 2) });
    }
    cursor = close + 2;
  }

  return segments.length > 0
    ? {
        kind: 'interpolated',
        name: '',
        segments,
        sourceLoc: { start: 0, end: 0 },
      }
    : null;
}

/**
 * Convert a TemplateAttr to AttributeBinding. Returns null if the attribute is
 * a directive/event (those are handled separately by the element walker).
 */
function lowerAttribute(
  attr: TemplateAttr,
  bindings: BindingsTable,
): AttributeBinding | null {
  if (attr.kind === 'directive' || attr.kind === 'event') {
    return null; // Handled in lowerElement directly.
  }

  if (attr.kind === 'static') {
    return {
      kind: 'static',
      name: attr.name,
      value: attr.value ?? '',
      sourceLoc: attr.loc,
    };
  }

  // kind === 'binding'
  if (attr.value === null) {
    // Boolean-style binding (rare); fall through with a null expression.
    return {
      kind: 'binding',
      name: attr.name,
      expression: t.booleanLiteral(true),
      deps: [],
      sourceLoc: attr.loc,
    };
  }

  // Detect mustache interpolation inside binding-value (Pitfall 11 / A4).
  const interp = parseInterpolatedSegments(attr.value, bindings);
  if (interp && interp.kind === 'interpolated') {
    return {
      ...interp,
      name: attr.name,
      sourceLoc: attr.loc,
    };
  }

  // Plain binding — parse as JS expression.
  const expr = tryParseExpression(attr.value);
  return {
    kind: 'binding',
    name: attr.name,
    expression: expr ?? t.identifier('undefined'),
    deps: expr ? computeExpressionDeps(expr, bindings) : [],
    sourceLoc: attr.loc,
  };
}

/**
 * Find a `:key` binding among the attrs.
 */
function findKeyExpression(
  attrs: TemplateAttr[],
  bindings: BindingsTable,
): t.Expression | null {
  const keyAttr = attrs.find(
    (a) => a.kind === 'binding' && a.name === 'key' && a.value !== null,
  );
  if (!keyAttr || !keyAttr.value) return null;
  return tryParseExpression(keyAttr.value);
}

/**
 * Find an `r-if` / `r-else-if` / `r-else` directive on a template element.
 */
function getConditionalDirective(
  el: ASTTemplateElement,
): { kind: 'if' | 'else-if' | 'else'; expr: string | null } | null {
  for (const a of el.attributes) {
    if (a.kind !== 'directive') continue;
    if (a.name === 'if') return { kind: 'if', expr: a.value };
    if (a.name === 'else-if') return { kind: 'else-if', expr: a.value };
    if (a.name === 'else') return { kind: 'else', expr: null };
  }
  return null;
}

/**
 * Find an `r-for` directive on a template element. Returns null if absent.
 */
function getRForDirective(el: ASTTemplateElement): TemplateAttr | null {
  return (
    el.attributes.find((a) => a.kind === 'directive' && a.name === 'for') ?? null
  );
}

/**
 * Lower a single ASTTemplateElement to IR. Handles r-for first (loop wrap),
 * then converts the bare element node.
 *
 * Note: r-if grouping is the parent walker's responsibility.
 */
function lowerElement(
  el: ASTTemplateElement,
  bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
  templateListeners: Listener[],
  pathPrefix: string,
  index: number,
): IRTemplateNode {
  const elPath = `${pathPrefix}/${el.tagName}-${index}`;

  // r-for wrap: if the element has r-for, produce a TemplateLoopIR whose body
  // is the bare element (without r-for).
  const rFor = getRForDirective(el);
  if (rFor && rFor.value !== null) {
    const aliases = extractRForAliases(rFor.value);
    // Strip the r-for value text after `in`/`of` to find iterable.
    const iterMatch = rFor.value.match(/\s+(?:in|of)\s+(.+)$/);
    const iterableText = iterMatch && iterMatch[1] ? iterMatch[1].trim() : rFor.value;
    const iterableExpression = tryParseExpression(iterableText) ?? t.nullLiteral();
    const iterableDeps = computeExpressionDeps(iterableExpression, bindings);
    const keyExpression = findKeyExpression(el.attributes, bindings);

    // Inner element WITHOUT r-for/r-if conditional (we strip below to
    // avoid an infinite recursion / double processing).
    const innerEl: ASTTemplateElement = {
      ...el,
      attributes: el.attributes.filter(
        (a) =>
          !(
            a.kind === 'directive' &&
            (a.name === 'for' ||
              a.name === 'if' ||
              a.name === 'else-if' ||
              a.name === 'else')
          ),
      ),
    };

    const inner = lowerBareElement(
      innerEl,
      bindings,
      depGraph,
      registry,
      diagnostics,
      templateListeners,
      elPath,
    );

    const loop: TemplateLoopIR = {
      type: 'TemplateLoop',
      itemAlias: aliases?.item ?? 'item',
      indexAlias: aliases?.index ?? null,
      iterableExpression,
      iterableDeps,
      keyExpression,
      body: [inner],
      sourceLoc: el.loc,
    };
    return loop;
  }

  return lowerBareElement(
    el,
    bindings,
    depGraph,
    registry,
    diagnostics,
    templateListeners,
    elPath,
  );
}

/**
 * Lower an element node WITHOUT r-for/r-if wrapping. Handles <slot>,
 * static + binding attrs, template @event bindings, recursive children.
 */
function lowerBareElement(
  el: ASTTemplateElement,
  bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
  templateListeners: Listener[],
  elPath: string,
): IRTemplateNode {
  // <slot> elements lower to TemplateSlotInvocationIR.
  if (el.tagName === 'slot') {
    let slotName = '';
    const args: TemplateSlotInvocationIR['args'] = [];
    for (const attr of el.attributes) {
      if (attr.kind === 'static' && attr.name === 'name' && attr.value !== null) {
        slotName = attr.value;
      } else if (attr.kind === 'binding' && attr.value !== null) {
        const expr = tryParseExpression(attr.value);
        if (expr) {
          args.push({
            name: attr.name,
            expression: expr,
            deps: computeExpressionDeps(expr, bindings),
          });
        }
      }
    }
    const fallback = lowerNodeList(
      el.children,
      bindings,
      depGraph,
      registry,
      diagnostics,
      templateListeners,
      elPath,
    );
    return {
      type: 'TemplateSlotInvocation',
      slotName,
      args,
      fallback,
      sourceLoc: el.loc,
    };
  }

  // Lower attributes + collect template @event listeners.
  const attributes: AttributeBinding[] = [];
  const events: Listener[] = [];

  for (const attr of el.attributes) {
    if (attr.kind === 'event') {
      const handlerExpr =
        attr.value !== null ? tryParseExpression(attr.value) : null;
      const handler = handlerExpr ?? t.identifier('undefined');
      const deps = handlerExpr ? computeExpressionDeps(handlerExpr, bindings) : [];

      const ctx: ModifierContext = {
        source: 'template-event',
        event: attr.name,
        sourceLoc: attr.loc,
      };
      const modifierPipeline = resolveModifierPipeline(
        attr.chain,
        ctx,
        registry,
        diagnostics,
      );
      const tplListener: Listener = {
        type: 'Listener',
        // Template event handlers bind to the element they're declared on —
        // semantically `$el` for the receiving emitter to resolve.
        target: { kind: 'self', el: '$el' },
        event: attr.name,
        modifierPipeline,
        when: null,
        handler,
        deps,
        source: 'template-event',
        sourceLoc: attr.loc,
      };
      events.push(tplListener);
      templateListeners.push(tplListener);
      continue;
    }

    if (attr.kind === 'directive') {
      // r-model is preserved as a binding for the emitter to expand into a
      // value+input pair.
      if (attr.name === 'model' && attr.value !== null) {
        const expr = tryParseExpression(attr.value);
        attributes.push({
          kind: 'binding',
          name: 'r-model',
          expression: expr ?? t.identifier('undefined'),
          deps: expr ? computeExpressionDeps(expr, bindings) : [],
          sourceLoc: attr.loc,
        });
      }
      // r-if / r-else / r-else-if / r-for handled at the parent walker.
      continue;
    }

    // static or binding
    const ab = lowerAttribute(attr, bindings);
    if (ab) attributes.push(ab);
  }

  const children = lowerNodeList(
    el.children,
    bindings,
    depGraph,
    registry,
    diagnostics,
    templateListeners,
    elPath,
  );

  const result: TemplateElementIR = {
    type: 'TemplateElement',
    tagName: el.tagName,
    attributes,
    events,
    children,
    sourceLoc: el.loc,
  };
  return result;
}

/**
 * Walk a sibling list. Groups consecutive r-if / r-else-if / r-else into a
 * single TemplateConditionalIR.
 */
function lowerNodeList(
  nodes: readonly ASTTemplateNode[],
  bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
  templateListeners: Listener[],
  pathPrefix: string,
): IRTemplateNode[] {
  const out: IRTemplateNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    if (node.type === 'TemplateText') {
      const t1: TemplateStaticTextIR = {
        type: 'TemplateStaticText',
        text: node.text,
        sourceLoc: node.loc,
      };
      out.push(t1);
      continue;
    }

    if (node.type === 'TemplateInterpolation') {
      const expr = tryParseExpression(node.rawExpr);
      const interp: TemplateInterpolationIR = {
        type: 'TemplateInterpolation',
        expression: expr ?? t.identifier('undefined'),
        deps: expr ? computeExpressionDeps(expr, bindings) : [],
        sourceLoc: node.loc,
      };
      out.push(interp);
      continue;
    }

    // TemplateElement
    const cond = getConditionalDirective(node);
    if (cond && cond.kind === 'if') {
      // Start a conditional group; consume siblings while they're else-if/else.
      const branches: TemplateConditionalIR['branches'] = [];
      const ifExpr = cond.expr ? tryParseExpression(cond.expr) : null;
      const ifDeps = ifExpr ? computeExpressionDeps(ifExpr, bindings) : [];
      const ifBody = [
        lowerElement(
          node,
          bindings,
          depGraph,
          registry,
          diagnostics,
          templateListeners,
          pathPrefix,
          i,
        ),
      ];
      branches.push({
        test: ifExpr,
        deps: ifDeps,
        body: ifBody,
        sourceLoc: node.loc,
      });

      // Look ahead for else-if / else siblings (skipping pure-whitespace
      // TemplateText separators).
      let j = i + 1;
      while (j < nodes.length) {
        const sib = nodes[j]!;
        if (sib.type === 'TemplateText' && sib.text.trim() === '') {
          j += 1;
          continue;
        }
        if (sib.type !== 'TemplateElement') break;
        const sibCond = getConditionalDirective(sib);
        if (!sibCond || sibCond.kind === 'if') break;
        const expr = sibCond.expr ? tryParseExpression(sibCond.expr) : null;
        branches.push({
          test: expr,
          deps: expr ? computeExpressionDeps(expr, bindings) : [],
          body: [
            lowerElement(
              sib,
              bindings,
              depGraph,
              registry,
              diagnostics,
              templateListeners,
              pathPrefix,
              j,
            ),
          ],
          sourceLoc: sib.loc,
        });
        j += 1;
      }

      out.push({
        type: 'TemplateConditional',
        branches,
        sourceLoc: node.loc,
      });
      i = j - 1; // continue from after the consumed siblings
      continue;
    }

    // Plain element (no conditional)
    out.push(
      lowerElement(
        node,
        bindings,
        depGraph,
        registry,
        diagnostics,
        templateListeners,
        pathPrefix,
        i,
      ),
    );
  }

  return out;
}

export function lowerTemplate(
  template: TemplateAST,
  bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  registry: ModifierRegistry,
  diagnostics: Diagnostic[],
): LowerTemplateResult {
  const templateListeners: Listener[] = [];
  const children = lowerNodeList(
    template.children,
    bindings,
    depGraph,
    registry,
    diagnostics,
    templateListeners,
    '',
  );

  let templateNode: IRTemplateNode | null;
  if (children.length === 0) {
    templateNode = null;
  } else if (children.length === 1) {
    templateNode = children[0]!;
  } else {
    templateNode = {
      type: 'TemplateFragment',
      children,
      sourceLoc: template.loc,
    };
  }

  return { template: templateNode, templateListeners };
}

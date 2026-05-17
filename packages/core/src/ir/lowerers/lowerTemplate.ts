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
import { isPascalCase } from '../utils/isPascalCase.js';
import { didYouMean } from '../../diagnostics/didYouMean.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { extractSlotFillers } from './lowerSlotFillers.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  AttributeBinding,
  ComponentDecl,
  Listener,
  SlotFillerDecl,
} from '../types.js';

/**
 * Per-element annotation of tagKind + diagnostic emission for Phase 06.2 P1
 * Task 3 / Task 4.
 *
 * Returns the resolved { tagKind, componentRef, used } triple. `used` is the
 * declared name (outerName or components-table entry) consumed by this tag —
 * tracked so Task 4's ROZ924 (UNUSED_COMPONENT_ENTRY) can skip referenced
 * entries after the walk.
 *
 * Escape-hatch sub-codes (D-124, resolves Open Question §2):
 *   - <Suspense>          → ROZ925 (React framework directly)
 *   - <Teleport>          → ROZ926 (Vue framework directly)
 *   - <ng-container>      → ROZ927 (Angular framework directly)
 *   - <svelte:fragment>   → ROZ928 (Svelte framework directly)
 *
 * Per-primitive hints provide better DX than a flat ROZ920 message.
 */
function annotateTagKind(
  tagName: string,
  outerName: string,
  componentsTable: Map<string, ComponentDecl>,
  declaredNames: readonly string[],
  diagnostics: Diagnostic[],
  loc: { start: number; end: number },
): {
  tagKind: 'html' | 'component' | 'self';
  componentRef?: ComponentDecl;
  /** Declared name consumed (outerName or components-table key); null when none. */
  used: string | null;
} {
  // Escape-hatch primitives FIRST — these short-circuit before PascalCase
  // path so we can emit per-primitive ROZ925..928 sub-codes.
  if (tagName === 'Suspense') {
    diagnostics.push({
      code: RozieErrorCode.ESCAPE_HATCH_REACT_SUSPENSE,
      severity: 'error',
      message: '<Suspense> is a React-specific primitive and is not part of Rozie.',
      loc,
      hint: 'For React <Suspense>, use the React framework directly. Rozie deliberately does not expose framework-specific primitives.',
    });
    return { tagKind: 'html', used: null };
  }
  if (tagName === 'Teleport') {
    diagnostics.push({
      code: RozieErrorCode.ESCAPE_HATCH_VUE_TELEPORT,
      severity: 'error',
      message: '<Teleport> is a Vue-specific primitive and is not part of Rozie.',
      loc,
      hint: 'For Vue <Teleport>, use the Vue framework directly. Rozie deliberately does not expose framework-specific primitives.',
    });
    return { tagKind: 'html', used: null };
  }
  if (tagName === 'ng-container') {
    diagnostics.push({
      code: RozieErrorCode.ESCAPE_HATCH_NG_CONTAINER,
      severity: 'error',
      message: '<ng-container> is an Angular-specific primitive and is not part of Rozie.',
      loc,
      hint: 'For Angular <ng-container>, use the Angular framework directly. Rozie deliberately does not expose framework-specific primitives.',
    });
    return { tagKind: 'html', used: null };
  }
  if (/^svelte:/i.test(tagName)) {
    diagnostics.push({
      code: RozieErrorCode.ESCAPE_HATCH_SVELTE_FRAGMENT,
      severity: 'error',
      message: `<${tagName}> is a Svelte-specific primitive and is not part of Rozie.`,
      loc,
      hint: 'For Svelte <svelte:fragment> / <svelte:*>, use the Svelte framework directly. Rozie deliberately does not expose framework-specific primitives.',
    });
    return { tagKind: 'html', used: null };
  }

  if (isPascalCase(tagName)) {
    if (tagName === outerName) {
      return { tagKind: 'self', used: outerName };
    }
    const decl = componentsTable.get(tagName);
    if (decl !== undefined) {
      return { tagKind: 'component', componentRef: decl, used: tagName };
    }
    // Unmatched PascalCase — ROZ920 with optional did-you-mean.
    const suggestion = didYouMean(tagName, declaredNames);
    diagnostics.push({
      code: RozieErrorCode.UNKNOWN_COMPONENT,
      severity: 'error',
      message: `Unknown component <${tagName}>. PascalCase tags must be declared in <components> (or match the outer <rozie name=>).`,
      loc,
      ...(suggestion !== null
        ? { hint: `Did you mean <${suggestion}>?` }
        : {
            hint:
              declaredNames.length === 0
                ? `Declare it in <components>: { ${tagName}: './${tagName}.rozie' }.`
                : `Declared components: ${declaredNames.map((n) => `<${n}>`).join(', ')}.`,
          }),
    });
    return { tagKind: 'html', used: null };
  }

  // Non-PascalCase — Task 4 ROZ922: lowercase variant of a declared PascalCase
  // is likely a typo. Compare lowercase-insensitively against declaredNames.
  const lowerHit = declaredNames.find((n) => n.toLowerCase() === tagName.toLowerCase());
  if (lowerHit) {
    diagnostics.push({
      code: RozieErrorCode.LOWERCASE_LIKELY_TYPO,
      severity: 'warning',
      message: `<${tagName}> looks like the declared component <${lowerHit}> but starts with a lowercase letter; Rozie treats it as an HTML tag.`,
      loc,
      hint: `Use <${lowerHit}> if you meant the declared component, or rename to a kebab-case custom-element name to silence this warning.`,
    });
    // Non-PascalCase passes through as 'html' regardless.
  }
  return { tagKind: 'html', used: null };
}

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
  outerName: string,
  componentsTable: Map<string, ComponentDecl>,
  declaredNames: readonly string[],
  usedNames: Set<string>,
  // Phase 07.2 D-06 — sticky-downward fill-body flag. Set true when the
  // recursion has crossed a SlotFillerDecl.body boundary; every <slot>
  // lowered with this true gets context: 'fill-body' (Pitfall 5).
  lowerInFillBody: boolean,
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
      outerName,
      componentsTable,
      declaredNames,
      usedNames,
      lowerInFillBody,
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
    outerName,
    componentsTable,
    declaredNames,
    usedNames,
    lowerInFillBody,
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
  outerName: string,
  componentsTable: Map<string, ComponentDecl>,
  declaredNames: readonly string[],
  usedNames: Set<string>,
  // Phase 07.2 D-06 — sticky-downward flag. When true, every <slot> lowered
  // here gets context: 'fill-body'; otherwise context: 'declaration' (default).
  lowerInFillBody: boolean,
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
    // Sticky-downward — <slot> fallback children inherit the same flag as
    // their parent. A <slot> inside a fill body stays 'fill-body'; outside
    // it stays 'declaration'.
    const fallback = lowerNodeList(
      el.children,
      bindings,
      depGraph,
      registry,
      diagnostics,
      templateListeners,
      elPath,
      outerName,
      componentsTable,
      declaredNames,
      usedNames,
      lowerInFillBody,
    );
    return {
      type: 'TemplateSlotInvocation',
      slotName,
      args,
      fallback,
      sourceLoc: el.loc,
      // Phase 07.2 D-06 — the sticky-downward `lowerInFillBody` flag is set
      // when the recursion has crossed any SlotFillerDecl.body boundary; every
      // nested <slot> inherits 'fill-body' until the recursion exits the body
      // (RESEARCH Pitfall 5 — re-projection-in-re-projection nesting).
      context: lowerInFillBody ? 'fill-body' : 'declaration',
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
      // Phase 07.3 TWO-WAY-01 — `r-model:propName="expr"` (consumer-side
      // two-way binding). The parser strips the `r-` prefix and produces
      // `name === 'model:<propName>'`. This branch MUST run BEFORE the
      // bare-`r-model` branch below so the colon form is never silently
      // routed into the form-input sugar path.
      //
      // The lowerer ALWAYS emits `kind: 'twoWayBinding'` when the directive
      // name starts with `model:` — even when the propName is empty
      // (`r-model:=`) or the target is a non-component HTML tag. Validation
      // of those shape errors happens in `validateTwoWayBindings` (ROZ950)
      // so the IR shape stays uniform and the validator owns all error
      // emission (matches the ROZ947 / threadParamTypes pattern).
      //
      // Empty value (no `="…"`) lowers with an `undefined` expression — the
      // validator's ROZ951 LHS rule will reject it (it's not a writable
      // lvalue).
      if (attr.name.startsWith('model:')) {
        const propName = attr.name.slice('model:'.length);
        const expr = attr.value !== null ? tryParseExpression(attr.value) : null;
        attributes.push({
          kind: 'twoWayBinding',
          name: propName,
          expression: expr ?? t.identifier('undefined'),
          deps: expr ? computeExpressionDeps(expr, bindings) : [],
          sourceLoc: attr.loc,
        });
        continue;
      }

      // r-model / r-show / r-html / r-text are preserved as binding
      // attributes (named with the `r-` prefix) for downstream emitters to
      // expand into target-specific output. r-if/r-else/r-else-if/r-for
      // are handled structurally at the parent walker (they wrap the
      // element in a TemplateConditional / TemplateLoop).
      if (
        (attr.name === 'model' ||
          attr.name === 'show' ||
          attr.name === 'html' ||
          attr.name === 'text') &&
        attr.value !== null
      ) {
        const expr = tryParseExpression(attr.value);
        attributes.push({
          kind: 'binding',
          name: `r-${attr.name}`,
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

  // Phase 06.2 P1 Task 3/4 — annotate tagKind + emit ROZ920..928 sub-codes
  // per D-114 precedence (outer-name first, then components table, then
  // HTML/custom-element fallback).
  //
  // Phase 07.2 D-06 — tagKind detection moves BEFORE the children-recursion so
  // the lowerInFillBody flag flips to true for every <slot> nested inside a
  // component-tag's fill bodies (Pitfall 5).
  const annotation = annotateTagKind(
    el.tagName,
    outerName,
    componentsTable,
    declaredNames,
    diagnostics,
    el.loc,
  );
  if (annotation.used !== null) {
    usedNames.add(annotation.used);
  }

  // Component-tag children form fill bodies (per D-03: any non-<template>
  // child becomes default-shorthand fill content; <template #name> children
  // are explicit fills). Every <slot> inside any of these bodies must lower
  // with context: 'fill-body' (re-projection semantics, D-06).
  const childIsFillBody =
    annotation.tagKind === 'component' || annotation.tagKind === 'self';
  const childFillBodyFlag = childIsFillBody ? true : lowerInFillBody;

  const children = lowerNodeList(
    el.children,
    bindings,
    depGraph,
    registry,
    diagnostics,
    templateListeners,
    elPath,
    outerName,
    componentsTable,
    declaredNames,
    usedNames,
    childFillBodyFlag,
  );

  // Phase 07.2 R3 — when this element is a component-tag, extract slot fillers
  // from its children. ROZ940 / ROZ942 / ROZ946 emit here via the lowerSlotFillers
  // diagnostic accumulator.
  let slotFillers: SlotFillerDecl[] | undefined;
  if (childIsFillBody) {
    const extracted = extractSlotFillers(el.children, children, diagnostics);
    if (extracted.length > 0) slotFillers = extracted;
  }

  const result: TemplateElementIR = {
    type: 'TemplateElement',
    tagName: el.tagName,
    attributes,
    events,
    children,
    sourceLoc: el.loc,
    tagKind: annotation.tagKind,
    // exactOptionalPropertyTypes: spread componentRef + slotFillers only when defined.
    ...(annotation.componentRef !== undefined
      ? { componentRef: annotation.componentRef }
      : {}),
    ...(slotFillers !== undefined ? { slotFillers } : {}),
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
  outerName: string,
  componentsTable: Map<string, ComponentDecl>,
  declaredNames: readonly string[],
  usedNames: Set<string>,
  // Phase 07.2 D-06 — sticky-downward fill-body flag inherited from caller.
  lowerInFillBody: boolean,
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
          outerName,
          componentsTable,
          declaredNames,
          usedNames,
          lowerInFillBody,
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
              outerName,
              componentsTable,
              declaredNames,
              usedNames,
              lowerInFillBody,
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
        outerName,
        componentsTable,
        declaredNames,
        usedNames,
        lowerInFillBody,
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
  outerName: string,
  componentsTable: Map<string, ComponentDecl>,
): LowerTemplateResult {
  const templateListeners: Listener[] = [];
  // Declared names available for did-you-mean + lowercase-typo detection.
  // Outer name precedes <components> entries (D-114 precedence).
  const declaredNames: string[] = [outerName, ...componentsTable.keys()];
  // Used names tracked for ROZ924 (UNUSED_COMPONENT_ENTRY).
  const usedNames = new Set<string>();
  const children = lowerNodeList(
    template.children,
    bindings,
    depGraph,
    registry,
    diagnostics,
    templateListeners,
    '',
    outerName,
    componentsTable,
    declaredNames,
    usedNames,
    // Phase 07.2 D-06 — root walk starts outside any fill body.
    false,
  );

  // Phase 06.2 P1 Task 4 — ROZ924: warn for declared <components> entries
  // never referenced anywhere in the template. Outer-name self-references
  // are not subject to ROZ924 (the parent is always trivially "used" by
  // virtue of being the file's own component).
  for (const [name, decl] of componentsTable) {
    if (!usedNames.has(name)) {
      diagnostics.push({
        code: RozieErrorCode.UNUSED_COMPONENT_ENTRY,
        severity: 'warning',
        message: `<components> declares '${name}' (${decl.importPath}) but it is never referenced in the template.`,
        loc: decl.sourceLoc,
        hint: 'Remove the unused entry, or use <' + name + '> in the template.',
      });
    }
  }

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

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
  TemplateMatchIR,
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
    // `{{ }}` mustache is permitted in plain (non-`:`) attribute values too —
    // a deliberate Rozie feature (Vue forbids it; see PROJECT.md). Lower it to
    // the same `interpolated` AttributeBinding the `:`-binding branch produces
    // below, so every target emits a real interpolation rather than the
    // literal `{{ }}` text. Values with no `{{` early-return null from
    // parseInterpolatedSegments and fall through to the plain `static` shape.
    if (attr.value !== null) {
      const interp = parseInterpolatedSegments(attr.value, bindings);
      if (interp && interp.kind === 'interpolated') {
        return {
          ...interp,
          name: attr.name,
          sourceLoc: attr.loc,
        };
      }
    }
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
 * Phase 11 — find an `r-match` / `r-case` / `r-default` directive on a
 * template element. Parallels `getConditionalDirective`. The parser strips the
 * `r-` prefix, so `a.name` is `match` / `case` / `default`.
 *
 * Returns the directive `attr` alongside `kind`/`expr` so the match-grouping
 * branch can attach the most specific source frame to ROZ953-959 diagnostics.
 */
function getMatchDirective(
  el: ASTTemplateElement,
): {
  kind: 'match' | 'case' | 'default';
  expr: string | null;
  attr: TemplateAttr;
} | null {
  for (const a of el.attributes) {
    if (a.kind !== 'directive') continue;
    if (a.name === 'match') return { kind: 'match', expr: a.value, attr: a };
    if (a.name === 'case') return { kind: 'case', expr: a.value, attr: a };
    if (a.name === 'default') return { kind: 'default', expr: null, attr: a };
  }
  return null;
}

/**
 * Phase 11 D-03 — per-component-unique hoist temp-name counter. A single
 * `{ next: number }` ref is created once per `lowerTemplate` call and threaded
 * through `lowerNodeList` recursion, so nested `r-match` blocks that hoist
 * never collide on `__rozieMatch_N` (RESEARCH Pitfall 5).
 */
interface MatchTempCounter {
  next: number;
}

/**
 * Phase 11 D-01 — fold one `r-case` value into a ready-to-emit branch test.
 *
 * The folded test is built entirely with `@babel/types` builders — never
 * string-concatenated from user expression text (threat T-11-02). The
 * comma-alternative form (a top-level `SequenceExpression` from
 * `tryParseExpression`) is an intentional Rozie sub-grammar — it lowers to a
 * `||`-chain of `===` comparisons (NOT `.includes()`, which does not narrow
 * for TypeScript — R3/R9).
 *
 * `discriminantExpr` is the raw discriminant when `discriminantMode` is
 * `'inline'`, or `t.identifier(tempName)` when `'hoist'`.
 */
function foldCaseTest(
  caseValue: t.Expression,
  discriminantExpr: t.Expression,
  discriminant: t.Expression,
): t.Expression {
  // Literal-boolean discriminant special case (R4).
  if (t.isBooleanLiteral(discriminant, { value: true })) {
    return caseValue; // bare predicate
  }
  if (t.isBooleanLiteral(discriminant, { value: false })) {
    return t.unaryExpression('!', caseValue);
  }
  // Comma-alternative sub-grammar — a top-level SequenceExpression.
  if (t.isSequenceExpression(caseValue)) {
    const comparisons: t.Expression[] = caseValue.expressions.map((v) =>
      t.binaryExpression('===', t.cloneNode(discriminantExpr), v),
    );
    return comparisons.reduce((acc, cmp) =>
      t.logicalExpression('||', acc, cmp),
    );
  }
  // Normal strict-equality case.
  return t.binaryExpression('===', discriminantExpr, caseValue);
}

/**
 * Phase 11 — derive a stable, type-tagged comparison key for an `r-case` value
 * for the ROZ959 duplicate-case check. Returns a tagged string when the value
 * is a literal the warning can compare (e.g. `s:foo`, `n:1`, `b:true`,
 * `null`); `undefined` for any non-literal (those are never flagged). Keys are
 * stored in a `Set` of these tagged *values* — never used as bare object keys
 * — as a prototype-pollution guard (threat T-11-03). The type tag also stops a
 * string `r-case="'1'"` colliding with a numeric `r-case="1"`.
 */
function caseLiteralValue(caseValue: t.Expression): string | undefined {
  if (t.isStringLiteral(caseValue)) return `s:${caseValue.value}`;
  if (t.isNumericLiteral(caseValue)) return `n:${caseValue.value}`;
  if (t.isBooleanLiteral(caseValue)) return `b:${caseValue.value}`;
  if (t.isNullLiteral(caseValue)) return 'null';
  // WR-03 — a negative numeric `r-case="-1"` parses (via @babel/parser) as a
  // UnaryExpression with operator `-` wrapping a NumericLiteral, NOT a plain
  // NumericLiteral. Special-case the unary-minus/plus-on-numeric form so two
  // `r-case="-1"` rungs are still caught by the ROZ959 duplicate-case check.
  if (
    t.isUnaryExpression(caseValue, { operator: '-' }) &&
    t.isNumericLiteral(caseValue.argument)
  ) {
    return `n:${-caseValue.argument.value}`;
  }
  if (
    t.isUnaryExpression(caseValue, { operator: '+' }) &&
    t.isNumericLiteral(caseValue.argument)
  ) {
    return `n:${+caseValue.argument.value}`;
  }
  return undefined;
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
  // Phase 11 D-03 — per-component hoist temp-name counter, threaded so nested
  // r-match blocks allocate distinct __rozieMatch_N names (Pitfall 5).
  matchCounter: MatchTempCounter,
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
      matchCounter,
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
    matchCounter,
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
  // Phase 11 D-03 — per-component hoist temp-name counter (Pitfall 5).
  matchCounter: MatchTempCounter,
): IRTemplateNode {
  // <slot> elements lower to TemplateSlotInvocationIR.
  if (el.tagName === 'slot') {
    let slotName = '';
    let isPortal = false;
    const args: TemplateSlotInvocationIR['args'] = [];
    for (const attr of el.attributes) {
      if (attr.kind === 'static' && attr.name === 'name' && attr.value !== null) {
        slotName = attr.value;
      } else if (attr.kind === 'static' && attr.name === 'portal' && attr.value === null) {
        // Portal-slot primitive (Spike 003) — boolean attribute.
        isPortal = true;
      } else if (attr.kind === 'binding' && attr.value !== null) {
        // Portal slots use `:params="['arg']"` as a TYPE DECLARATION (consumed
        // by lowerSlots into SlotDecl.portalParamNames) — strip it here so it
        // doesn't reach the per-target template emitter as a normal scoped
        // binding. Non-portal slots and other bindings are passed through.
        if (attr.name === 'params') continue;
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
      matchCounter,
    );
    const inv: TemplateSlotInvocationIR = {
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
    if (isPortal) inv.isPortal = true;
    return inv;
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
      //
      // ROZ952 — typo'd colon-form directive. The colon-argument shape
      // `r-<base>:<arg>` is only valid on `r-model` (two-way binding); no
      // other Rozie directive takes a colon argument. A `<base>` that is a
      // near-miss of `model` (Levenshtein <= 2) but not exactly `model` is
      // almost certainly a typo — and would otherwise be silently dropped,
      // since no branch below matches it. Emit a did-you-mean and skip.
      const colonIdx = attr.name.indexOf(':');
      if (colonIdx > 0) {
        const directiveBase = attr.name.slice(0, colonIdx);
        if (
          directiveBase !== 'model' &&
          didYouMean(directiveBase, ['model']) === 'model'
        ) {
          const directiveArg = attr.name.slice(colonIdx + 1);
          diagnostics.push({
            code: RozieErrorCode.TWO_WAY_DIRECTIVE_TYPO,
            severity: 'error',
            message: `Unknown directive 'r-${attr.name}' — did you mean 'r-model:${directiveArg}'? The colon-argument form is only valid on r-model (consumer-side two-way binding).`,
            loc: attr.loc,
            hint: `Write 'r-model:${directiveArg}="…"' for a two-way binding to the '${directiveArg}' prop.`,
          });
          continue;
        }
      }

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
    matchCounter,
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
 * single TemplateConditionalIR; groups an r-match host plus its r-case /
 * r-default children into a single TemplateMatchIR (Phase 11).
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
  // Phase 11 D-03 — per-component hoist temp-name counter (Pitfall 5).
  matchCounter: MatchTempCounter,
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

    // Phase 11 — r-match grouping. An element carrying `r-match` is the group
    // HEAD; its `r-case` / `r-default` rungs are CHILDREN of the host (not
    // siblings, unlike the r-if ladder). The whole construct collapses into a
    // single folded TemplateMatchIR. All seven ROZ953-959 diagnostics are
    // detected inline here (D-05) and pushed — never thrown.
    const matchDir = getMatchDirective(node);
    if (matchDir && matchDir.kind === 'match') {
      // Parse the discriminant. An empty/whitespace-only/unparseable r-match
      // value is ROZ953 — push and skip the node entirely.
      const discriminantText = matchDir.expr;
      const discriminant =
        discriminantText && discriminantText.trim() !== ''
          ? tryParseExpression(discriminantText)
          : null;
      if (discriminant === null) {
        diagnostics.push({
          code: RozieErrorCode.MATCH_EMPTY_DISCRIMINANT,
          severity: 'error',
          message: `r-match requires a discriminant expression.`,
          loc: matchDir.attr.loc,
          hint: `Write r-match="<expression>" — e.g. r-match="status". Use r-match="true" for a predicate chain.`,
        });
        continue;
      }

      // D-03 hoist classification. A bare Identifier / MemberExpression is
      // cheap — inline it into every rung. A CallExpression (or anything else
      // non-trivial) is hoisted so it evaluates exactly once; allocate a
      // per-component-unique temp name from the threaded counter.
      const isInline =
        t.isIdentifier(discriminant) || t.isMemberExpression(discriminant);
      const discriminantMode: 'inline' | 'hoist' = isInline ? 'inline' : 'hoist';
      const tempName = isInline
        ? undefined
        : `__rozieMatch_${matchCounter.next++}`;
      // The expression substituted into each folded branch test.
      const discriminantExpr: t.Expression =
        tempName !== undefined ? t.identifier(tempName) : discriminant;

      const branches: TemplateMatchIR['branches'] = [];
      // ROZ959 — track seen literal r-case values by a type-tagged key
      // (NOT used as a bare object key — prototype-pollution guard, T-11-03).
      const seenLiterals = new Set<string>();
      let defaultSeen = false;

      for (let k = 0; k < node.children.length; k++) {
        const child = node.children[k]!;
        // Pure-whitespace text between rungs is skipped silently.
        if (child.type === 'TemplateText') {
          if (child.text.trim() === '') continue;
          // Non-whitespace bare text is a stray child.
          diagnostics.push({
            code: RozieErrorCode.MATCH_STRAY_CHILD,
            severity: 'error',
            message: `An r-match host may only contain r-case / r-default elements.`,
            loc: child.loc,
            hint: `Wrap stray content in <template r-case="…"> or <template r-default>.`,
          });
          continue;
        }
        if (child.type !== 'TemplateElement') {
          diagnostics.push({
            code: RozieErrorCode.MATCH_STRAY_CHILD,
            severity: 'error',
            message: `An r-match host may only contain r-case / r-default elements.`,
            loc: child.loc,
            hint: `Wrap stray content in <template r-case="…"> or <template r-default>.`,
          });
          continue;
        }

        const childDir = getMatchDirective(child);
        if (!childDir || childDir.kind === 'match') {
          // A child element with neither r-case nor r-default (or a nested
          // r-match host, which is not a valid direct rung) is stray.
          diagnostics.push({
            code: RozieErrorCode.MATCH_STRAY_CHILD,
            severity: 'error',
            message: `Direct children of an r-match host must carry r-case or r-default.`,
            loc: child.loc,
            hint: `Add r-case="<value>" or r-default to <${child.tagName}>, or move it out of the r-match block.`,
          });
          continue;
        }

        // An r-case rung that follows an r-default is misordered (ROZ957).
        // WR-01 — restrict to `kind === 'case'`: a SECOND r-default that
        // follows the first is a duplicate, not "not last", and must emit
        // only ROZ958 below — never ROZ957+ROZ958 for one mistake.
        if (defaultSeen && childDir.kind === 'case') {
          diagnostics.push({
            code: RozieErrorCode.MATCH_DEFAULT_NOT_LAST,
            severity: 'error',
            message: `r-default must be the last branch of an r-match block.`,
            loc: childDir.attr.loc,
            hint: `Move r-default after every r-case branch.`,
          });
        }

        if (childDir.kind === 'default') {
          if (defaultSeen) {
            // WR-04 — a SECOND r-default: emit ONLY the diagnostic and do
            // NOT push it into `branches[]`. A `branches[]` with two trailing
            // `test: null` entries is structurally invalid for every
            // per-target `emitConditional` (React/Solid overwrite the chain,
            // Vue/Svelte emit a doubled `v-else`/`{:else}`). Pruning the extra
            // rung keeps the IR shape stable regardless of source malformation.
            diagnostics.push({
              code: RozieErrorCode.MATCH_MULTIPLE_DEFAULT,
              severity: 'error',
              message: `An r-match block may declare at most one r-default branch.`,
              loc: childDir.attr.loc,
              hint: `Remove the extra r-default — only the first catch-all branch is reachable.`,
            });
            continue;
          }
          defaultSeen = true;
          // Phase 11 R8 / CR-01 — a `<template r-default>` host is
          // non-rendering: emit its CHILDREN directly (flattened, multi-node
          // body) rather than a literal `TemplateElement{tagName:'template'}`,
          // which 5/6 targets would render as an inert HTML `<template>`. A
          // real-element host (e.g. `<p r-default>`) keeps `[lowerElement]`.
          // Mirrors the `r-match` host-unwrap below.
          branches.push({
            test: null,
            deps: [],
            body:
              child.tagName === 'template'
                ? lowerNodeList(
                    child.children,
                    bindings,
                    depGraph,
                    registry,
                    diagnostics,
                    templateListeners,
                    pathPrefix,
                    outerName,
                    componentsTable,
                    declaredNames,
                    usedNames,
                    lowerInFillBody,
                    matchCounter,
                  )
                : [
                    lowerElement(
                      child,
                      bindings,
                      depGraph,
                      registry,
                      diagnostics,
                      templateListeners,
                      pathPrefix,
                      k,
                      outerName,
                      componentsTable,
                      declaredNames,
                      usedNames,
                      lowerInFillBody,
                      matchCounter,
                    ),
                  ],
            sourceLoc: child.loc,
          });
          continue;
        }

        // childDir.kind === 'case'.
        // r-case + r-for on the same element is forbidden (ROZ956).
        if (getRForDirective(child) !== null) {
          diagnostics.push({
            code: RozieErrorCode.MATCH_CASE_WITH_FOR,
            severity: 'error',
            message: `r-case and r-for cannot appear on the same element.`,
            loc: childDir.attr.loc,
            hint: `Wrap the r-for element in a <template r-case="…"> rung instead.`,
          });
        }

        // A valueless r-case is ROZ955 — still lower the rung with a
        // null-literal placeholder test so the IR shape stays stable.
        const caseText = childDir.expr;
        const caseValue =
          caseText && caseText.trim() !== ''
            ? tryParseExpression(caseText)
            : null;
        if (caseValue === null) {
          diagnostics.push({
            code: RozieErrorCode.MATCH_CASE_NO_VALUE,
            severity: 'error',
            message: `r-case requires a value.`,
            loc: childDir.attr.loc,
            hint: `Write r-case="<value>", or use r-default for the catch-all branch.`,
          });
        } else {
          // ROZ959 — duplicate literal r-case value (first occurrence wins).
          const literal = caseLiteralValue(caseValue);
          if (literal !== undefined) {
            if (seenLiterals.has(literal)) {
              diagnostics.push({
                code: RozieErrorCode.MATCH_DUPLICATE_CASE,
                severity: 'warning',
                message: `Duplicate r-case value — this branch is unreachable; the first occurrence wins.`,
                loc: childDir.attr.loc,
                hint: `Remove the duplicate r-case, or change its value.`,
              });
            } else {
              seenLiterals.add(literal);
            }
          }
        }

        const folded =
          caseValue !== null
            ? foldCaseTest(caseValue, discriminantExpr, discriminant)
            : t.nullLiteral();
        // Phase 11 R8 / CR-01 — a `<template r-case>` host is non-rendering:
        // emit its CHILDREN directly (flattened, multi-node body) rather than
        // a literal `TemplateElement{tagName:'template'}`, which 5/6 targets
        // would render as an inert HTML `<template>`. A real-element host
        // (e.g. `<p r-case>`) keeps `[lowerElement]`. Mirrors the `r-match`
        // host-unwrap below.
        branches.push({
          test: folded,
          deps: computeExpressionDeps(folded, bindings),
          body:
            child.tagName === 'template'
              ? lowerNodeList(
                  child.children,
                  bindings,
                  depGraph,
                  registry,
                  diagnostics,
                  templateListeners,
                  pathPrefix,
                  outerName,
                  componentsTable,
                  declaredNames,
                  usedNames,
                  lowerInFillBody,
                  matchCounter,
                )
              : [
                  lowerElement(
                    child,
                    bindings,
                    depGraph,
                    registry,
                    diagnostics,
                    templateListeners,
                    pathPrefix,
                    k,
                    outerName,
                    componentsTable,
                    declaredNames,
                    usedNames,
                    lowerInFillBody,
                    matchCounter,
                  ),
                ],
          sourceLoc: child.loc,
        });
      }

      // A real-element host (`<div r-match>`) keeps its <div> wrapper; a
      // `<template r-match>` host is non-rendering (hostElement undefined).
      let hostElement: TemplateElementIR | undefined;
      if (node.tagName !== 'template') {
        // Lower the host element WITHOUT its r-case/r-default children — the
        // children are the branches. Strip the r-match directive so the
        // wrapper element itself carries no leftover match attribute.
        const hostShell: ASTTemplateElement = {
          ...node,
          attributes: node.attributes.filter(
            (a) => !(a.kind === 'directive' && a.name === 'match'),
          ),
          children: [],
        };
        const loweredHost = lowerElement(
          hostShell,
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
          matchCounter,
        );
        if (loweredHost.type === 'TemplateElement') {
          hostElement = loweredHost;
        }
      }

      const matchNode: TemplateMatchIR = {
        type: 'TemplateMatch',
        discriminant,
        discriminantMode,
        ...(tempName !== undefined ? { tempName } : {}),
        branches,
        ...(hostElement !== undefined ? { hostElement } : {}),
        sourceLoc: node.loc,
      };
      out.push(matchNode);
      continue;
    }

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
          matchCounter,
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
              matchCounter,
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
        matchCounter,
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
  // Phase 11 D-03 — one hoist temp-name counter per component (per
  // lowerTemplate call), so nested r-match blocks never collide on
  // __rozieMatch_N (Pitfall 5).
  const matchCounter: MatchTempCounter = { next: 0 };
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
    matchCounter,
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

/**
 * annotateDisplayWrap — Phase 26 Plan 03 (D-06/D-07).
 *
 * Post-IR mutating pass that resolves the wrap/raw decision ONCE per
 * interpolation and per attribute/class binding, recording it on the
 * `wrapForDisplay` boolean of `TemplateInterpolationIR` and the
 * `binding` / `interpolated`-segment `AttributeBinding` nodes.
 *
 * Why a single shared pass (not 5× per-target re-derivation):
 *   `lowerToIR` is the single chokepoint shared by `compile()` AND
 *   `@rozie/unplugin`'s own `parse → lowerToIR → emit{Target}` pipeline (the
 *   same reason `typeNeutralizeScript` / `validateClassSelector` run here). All
 *   five non-Vue emitters then read ONE pre-resolved boolean instead of
 *   re-running the type analysis five times — guaranteeing cross-target
 *   agreement (the exact parity bar this phase exists to enforce). Vue is left
 *   raw and never reads `wrapForDisplay`.
 *
 * The gate (D-07) — type-driven, wrap-when-unsure:
 *   `wrapForDisplay = !provablyPrimitive(expr, ir)`. Stay RAW
 *   (`wrapForDisplay=false`) ONLY when the expression's static type provably
 *   resolves to `string|number|boolean`:
 *     - string/number/boolean literals
 *     - `$props.x` whose `PropDecl.typeAnnotation` is the identifier
 *       `String`/`Number`/`Boolean`
 *     - `$data.x` whose `StateDecl.initializer` is a trivially-literal
 *       number/string/boolean (OQ2 — `<data>` carries no declared type, so the
 *       initializer is the only available signal; see Pitfall 1)
 *     - `.length` member access (always a number)
 *     - `typeof x` (UnaryExpression `typeof` → string)
 *     - comparison BinaryExpression (`=== !== < > <= >= == !=` → boolean)
 *     - `!x` (UnaryExpression `!` → boolean)
 *     - `String(x)` / `Number(x)` coercion CallExpressions
 *   Everything else WRAPs (`wrapForDisplay=true`): object/array/union/untyped
 *   props, untyped member chains (r-for aliases emit `any`), any
 *   non-String/Number CallExpression, an identifier reference to a `$computed`
 *   (OQ1 — v1 does NOT resolve computed return types, so wrap), and
 *   `&&`/`||`/`??` LogicalExpressions (Pitfall 5 — they return an OPERAND, not a
 *   boolean, so the result can be a non-primitive).
 *
 *   The invariant: a false-WRAP is behavior-neutral, but a false-RAW
 *   re-introduces the React "Objects are not valid as a React child" crash —
 *   so the predicate defaults to WRAP on ANY uncertainty.
 *
 * safeInterpolation off (D-13): when `safeInterpolation === false`, EVERY
 * interpolation/binding is forced `wrapForDisplay = false` (raw per-target
 * emit, pre-phase behavior) and the predicate is never consulted. No
 * `rozieDisplay` import/wrap is emitted downstream.
 *
 * Per D-08 collected-not-thrown: this pass NEVER throws. It mutates the IR in
 * place (mirrors `typeNeutralizeScript`) and consults already-diagnosed
 * expressions only — malformed expressions were diagnosed pre-IR.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { Expression } from '@babel/types';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  StateDecl,
  TemplateNode,
} from './types.js';

/** The reserved-object sigils whose `.member` reads the gate type-resolves. */
const SIGIL_PROPS = '$props';
const SIGIL_DATA = '$data';
// `$model` is the producer-side writable alias of a `model: true` <props>
// entry — `$model.x` reads the SAME declared prop as `$props.x`, so it must
// type-resolve identically (otherwise a `$model.value` Number read would
// false-WRAP while the byte-identical `$props.value` form stays raw, breaking
// the producer-side two-way-write byte-identity invariant — Phase 26 Plan 04).
const SIGIL_MODEL = '$model';

/** Comparison operators whose BinaryExpression result is provably a boolean. */
const COMPARISON_OPERATORS = new Set([
  '===',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '==',
  '!=',
]);

/** A PropTypeAnnotation that is provably the primitive `String`/`Number`/`Boolean`. */
function isPrimitivePropAnnotation(annotation: PropTypeAnnotation): boolean {
  if (annotation.kind === 'identifier') {
    return (
      annotation.name === 'String' ||
      annotation.name === 'Number' ||
      annotation.name === 'Boolean'
    );
  }
  if (annotation.kind === 'literal') {
    return (
      annotation.value === 'string' ||
      annotation.value === 'number' ||
      annotation.value === 'boolean'
    );
  }
  // 'union' (and any other shape) is not provably a single primitive → wrap.
  return false;
}

/** A `StateDecl.initializer` that is a trivially-literal number/string/boolean (OQ2). */
function isPrimitiveStateInitializer(init: Expression | null | undefined): boolean {
  if (!init) return false;
  return (
    t.isNumericLiteral(init) ||
    t.isStringLiteral(init) ||
    t.isBooleanLiteral(init)
  );
}

/**
 * The whole gate predicate: `true` when `expr` provably resolves to
 * `string|number|boolean`. Conservative by construction — any case not
 * enumerated returns `false` so the caller WRAPs (the false-raw invariant).
 */
function provablyPrimitive(
  expr: Expression,
  props: Map<string, PropDecl>,
  state: Map<string, StateDecl>,
  computedNames: Set<string>,
): boolean {
  // --- Literals ---
  if (t.isStringLiteral(expr) || t.isNumericLiteral(expr) || t.isBooleanLiteral(expr)) {
    return true;
  }

  // --- UnaryExpression: `typeof x` → string; `!x` → boolean ---
  if (t.isUnaryExpression(expr)) {
    return expr.operator === 'typeof' || expr.operator === '!';
  }

  // --- Comparison BinaryExpression → boolean ---
  // (`+`/`-`/`*` etc. are NOT enumerated: `+` is ambiguous number-add vs concat,
  // and arithmetic on a non-number coerces unpredictably — wrap to be safe.)
  if (t.isBinaryExpression(expr)) {
    return COMPARISON_OPERATORS.has(expr.operator);
  }

  // --- LogicalExpression (&&/||/??) → recurse into BOTH operands (Pitfall 5) ---
  // `&&`/`||`/`??` return an OPERAND, not a coerced boolean, so the result is
  // provably primitive IFF every operand is provably primitive. `a || obj`
  // (obj non-primitive) still WRAPs — preserving the false-raw safety
  // invariant — while an all-primitive chain like `$props.disabled ||
  // $data.uploading` (both Boolean) correctly stays RAW. Wrapping the latter
  // is NOT behavior-neutral: it feeds a `string` into a `boolean` DOM
  // attribute (`:disabled`), which both breaks tsc (string≠boolean) AND flips
  // runtime semantics (the string "false" is truthy). Recursing fixes both.
  if (t.isLogicalExpression(expr)) {
    return (
      provablyPrimitive(expr.left, props, state, computedNames) &&
      provablyPrimitive(expr.right, props, state, computedNames)
    );
  }

  // --- CallExpression: only String(...) / Number(...) coercions are primitive ---
  if (t.isCallExpression(expr)) {
    const callee = expr.callee;
    if (t.isIdentifier(callee) && (callee.name === 'String' || callee.name === 'Number')) {
      return true;
    }
    return false;
  }

  // --- MemberExpression ---
  if (t.isMemberExpression(expr) || t.isOptionalMemberExpression(expr)) {
    // `.length` is always a number, regardless of the object chain.
    const property = expr.property;
    if (!expr.computed && t.isIdentifier(property) && property.name === 'length') {
      return true;
    }

    // `$props.x` — resolve x's declared type from PropDecl.
    // `$data.x`  — infer x's primitiveness from the StateDecl initializer (OQ2).
    const object = expr.object;
    if (
      t.isIdentifier(object) &&
      !expr.computed &&
      t.isIdentifier(property)
    ) {
      if (object.name === SIGIL_PROPS || object.name === SIGIL_MODEL) {
        // `$model.x` reads the same declared prop as `$props.x` (model alias).
        const decl = props.get(property.name);
        return decl ? isPrimitivePropAnnotation(decl.typeAnnotation) : false;
      }
      if (object.name === SIGIL_DATA) {
        const decl = state.get(property.name);
        return decl ? isPrimitiveStateInitializer(decl.initializer) : false;
      }
    }

    // Any other member chain (untyped r-for alias `item.text`, nested access,
    // computed member) is `any` → wrap.
    return false;
  }

  // --- Bare Identifier ---
  if (t.isIdentifier(expr)) {
    // An identifier referencing a `$computed` (OQ1 — do NOT resolve the
    // computed's return type in v1) → wrap. Any other bare identifier is an
    // untyped local / alias → wrap.
    void computedNames; // identifiers always wrap; tracked for documentation parity
    return false;
  }

  // --- Everything else (ObjectExpression, ArrayExpression, TemplateLiteral,
  //     ConditionalExpression, etc.) → wrap. ---
  return false;
}

/** Recursive template walker — mirrors validateClassSelector.walkTemplate. */
function walkTemplate(node: TemplateNode | null, visit: (n: TemplateNode) => void): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
    case 'TemplateMatch':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/**
 * Resolve `wrapForDisplay` for every interpolation + attribute/class binding in
 * the component's template. Mutates the IR in place; never throws.
 *
 * @param ir                - the lowered IRComponent
 * @param safeInterpolation - the effective flag (envelope attr > global option
 *                            > default true), resolved upstream in lowerToIR.
 *                            When `false`, every gate is forced to `false`.
 */
export function annotateDisplayWrap(ir: IRComponent, safeInterpolation: boolean): void {
  // Index the declared props / data / computed names once.
  const props = new Map<string, PropDecl>();
  for (const decl of ir.props) props.set(decl.name, decl);
  const state = new Map<string, StateDecl>();
  for (const decl of ir.state) state.set(decl.name, decl);
  const computedNames = new Set<string>();
  for (const decl of ir.computed) computedNames.add(decl.name);

  const decide = (expr: Expression): boolean => {
    if (!safeInterpolation) return false;
    // wrap-when-unsure: wrap iff NOT provably primitive.
    return !provablyPrimitive(expr, props, state, computedNames);
  };

  walkTemplate(ir.template, (node) => {
    if (node.type === 'TemplateInterpolation') {
      node.wrapForDisplay = decide(node.expression);
      return;
    }
    if (node.type !== 'TemplateElement') return;
    for (const attr of node.attributes) {
      switch (attr.kind) {
        case 'binding':
          attr.wrapForDisplay = decide(attr.expression);
          break;
        case 'interpolated':
          for (const seg of attr.segments) {
            if (seg.kind === 'binding') {
              seg.wrapForDisplay = decide(seg.expression);
            }
          }
          break;
        case 'static':
        case 'twoWayBinding':
        case 'spreadBinding':
          // static text carries no expression; twoWayBinding (`r-model:`) is a
          // writable lvalue not a display read; spreadBinding applies an object
          // as attributes (no single display value). None gate.
          break;
      }
    }
  });
}

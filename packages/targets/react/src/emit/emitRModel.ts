/**
 * emitRModel — Plan 04-03 Task 3 (React target).
 *
 * Lowers a TemplateElement's `r-model="$data.X"` (or `$props.X` for model:true)
 * binding into the React controlled-input pattern per RESEARCH Pattern 7.
 *
 * Patterns (chosen by element tag + type):
 *   - <input type="text"> (default) → value={X} onChange={($event) => setX($event.target.value)}
 *   - <input type="checkbox">       → checked={X} onChange={($event) => setX($event.target.checked)}
 *   - <input type="radio" value="V">→ checked={X === 'V'} onChange={($event) => setX('V')}
 *   - <select>                       → value={X} onChange={($event) => setX($event.target.value)}
 *   - <textarea>                     → value={X} onChange={($event) => setX($event.target.value)}
 *   - <CustomComponent>              → value={X} onValueChange={setX}
 *
 * The setter name comes from looking up X's StateDecl/PropDecl in the IR.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import { parseExpression } from '@babel/parser';
import type {
  IRComponent,
  TemplateElementIR,
  AttributeBinding,
  ResolvedModelModifier,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
// Phase 06.2 P1 D-116 — shared PascalCase predicate. Replaces the local
// isCustomComponent fn so IR lowering and per-target emit cannot drift.
import { isPascalCase } from '../../../../core/src/ir/utils/isPascalCase.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: true };

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Resolve the model target's local name + setter name from the IR.
 *
 *   - `$data.query` → { local: 'query', setter: 'setQuery' }
 *   - `$props.value` (model:true) → { local: 'value', setter: 'setValue' }
 */
function resolveModelTarget(
  expr: t.Expression,
  ir: IRComponent,
): { local: string; setter: string } | null {
  if (!t.isMemberExpression(expr)) return null;
  if (expr.computed) return null;
  const obj = expr.object;
  const prop = expr.property;
  if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return null;

  if (obj.name === '$data') {
    if (!ir.state.find((s) => s.name === prop.name)) return null;
    return { local: prop.name, setter: 'set' + capitalize(prop.name) };
  }
  if (obj.name === '$props') {
    const p = ir.props.find((p) => p.name === prop.name);
    if (!p || !p.isModel) return null;
    return { local: prop.name, setter: 'set' + capitalize(prop.name) };
  }
  return null;
}

/**
 * Find a static attribute by name; returns the value or null.
 */
function getStaticAttr(
  attrs: AttributeBinding[],
  name: string,
): string | null {
  for (const a of attrs) {
    if (a.kind === 'static' && a.name === name) return a.value;
  }
  return null;
}

export interface EmitRModelResult {
  /** Replacement attributes (e.g., value=, onChange=) to splice in place of r-model */
  replacementAttributes: AttributeBinding[];
  diagnostics: Diagnostic[];
}

/**
 * Build a synthetic AttributeBinding for an expression value (binding kind).
 * Uses parseExpression-style construction; we wrap into a Babel Identifier
 * or CallExpression as needed and embed into binding.expression.
 */
function makeBindingAttr(name: string, expression: t.Expression): AttributeBinding {
  return {
    kind: 'binding',
    name,
    expression,
    deps: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

/**
 * Phase 12 — partition the resolved `r-model` modifier list into the two
 * orthogonal concerns the emitter handles:
 *   - `valueTransforms`: ordered `$v`-placeholder code fragments from every
 *     modifier that declares one (the list is ALREADY canonicalized per D-07:
 *     `.trim` -> custom string-transforms -> `.number` terminal).
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 */
function partitionModifiers(
  modifiers: ResolvedModelModifier[] | undefined,
): { valueTransforms: string[]; isLazy: boolean; resultType: string | undefined } {
  const valueTransforms: string[] = [];
  let isLazy = false;
  // Spike-012 R7-2 — the composed transform's contractual result type is the
  // LAST modifier that declares one (the chain is D-07-canonical: `.number` is
  // terminal, so its `'number'` wins). Absent ⇒ no cast.
  let resultType: string | undefined;
  for (const m of modifiers ?? []) {
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
    if (m.descriptor.valueTransformResultType) resultType = m.descriptor.valueTransformResultType;
  }
  return { valueTransforms, isLazy, resultType };
}

/**
 * Spike-012 R7-2 — wrap a committed value node in `(<node> as <resultType>)`
 * when the modifier chain declares a contractual result type (`.number` →
 * `'number'`). The `.number` transform's runtime result is `string | number`
 * (the `looseToNumber` NaN→string fallback), but the author asked for a number
 * and Vue types the model `number`; the cast keeps the value assignable to the
 * typed setter (react `setX`) — a pure type assertion, byte-runtime-neutral.
 * `resultType` is parsed once as a probe (`null as <resultType>`) to obtain a
 * real `TSType` node, so any type string works; a parse failure degrades to the
 * uncast node (never a crash). Absent resultType ⇒ the node is returned
 * unchanged, so bare / `.trim`-only r-model stays byte-identical.
 */
function applyResultTypeCast(node: t.Expression, resultType: string | undefined): t.Expression {
  if (!resultType) return node;
  try {
    // The `typescript` plugin is required — `parseExpression('null as number')`
    // throws under the default (non-TS) parser, which silently dropped the cast.
    const probe = parseExpression(`null as ${resultType}`, { plugins: ['typescript'] });
    if (t.isTSAsExpression(probe)) return t.tsAsExpression(node, probe.typeAnnotation);
  } catch {
    /* fall through — degrade to the uncast node */
  }
  return node;
}

/**
 * Phase 12 / CR-02 (12-REVIEW) — substitute the reserved `$v` value-access
 * placeholder token in a `valueTransform` fragment. Token-aware: only `$v`
 * appearing as a standalone token (not part of a longer identifier such as
 * `$value` or `__$v_tmp`) is replaced, so a chain step whose intermediate
 * output contains the literal substring `$v` cannot be double-substituted by
 * a later iteration. `$` is a JS identifier character, so the lookbehind
 * excludes both `\w` and `$` and the lookahead excludes `\w`.
 */
function substituteValuePlaceholder(
  fragment: string,
  replacement: string,
): string {
  return fragment.replace(/(?<![\w$])\$v(?!\w)/g, `(${replacement})`);
}

/**
 * Phase 12 — apply the resolved `valueTransform` fragments to a value-access
 * expression node. Each fragment is a string containing the literal `$v`
 * placeholder (D-03). Starting from the value-access node, substitute `$v`
 * with the current expression's generated source, re-parse the result, and
 * chain. When `valueTransforms` is empty, the input node is returned
 * unchanged — so non-modifier `r-model` stays byte-identical to pre-phase.
 *
 * CR-03 (12-REVIEW) — `parseExpression` is wrapped in try/catch so a custom
 * modifier whose `valueTransform` produces invalid JS after substitution
 * yields a COLLECTED diagnostic (D-08 collected-not-thrown) instead of an
 * uncaught crash. On failure the raw value-access node is returned and the
 * remaining transforms are skipped.
 */
function applyValueTransforms(
  valueAccess: t.Expression,
  valueTransforms: string[],
  diagnostics: Diagnostic[],
): t.Expression {
  let current = valueAccess;
  for (const fragment of valueTransforms) {
    const currentSrc = generate(current, GEN_OPTS).code;
    const substituted = substituteValuePlaceholder(fragment, currentSrc);
    try {
      current = parseExpression(substituted);
    } catch (err) {
      // D-08 — collect, never throw. A malformed custom-modifier fragment
      // must surface as a ROZ diagnostic, not an uncaught compiler crash.
      diagnostics.push({
        code: RozieErrorCode.RMODEL_UNKNOWN_MODIFIER,
        severity: 'error',
        message: `r-model modifier valueTransform produced invalid JS after $v substitution: ${String(err)}`,
        loc: { start: 0, end: 0 },
        hint: 'Check the custom model modifier’s valueTransform fragment — it must be a valid JS expression once `$v` is substituted.',
      });
      return valueAccess;
    }
  }
  return current;
}

/**
 * Emit r-model lowering. Returns the set of replacement attributes
 * (e.g., value, checked, onChange/onValueChange).
 *
 * Important: this function returns AttributeBinding[] so the caller can
 * substitute the r-model attribute with these new bindings, then proceed
 * through normal emitAttributes flow. The expressions encoded in the
 * replacement attributes are rewritten via rewriteTemplateExpression at
 * emit time, so we encode them as Babel identifier/call nodes.
 */
export function emitRModel(
  element: TemplateElementIR,
  ir: IRComponent,
): EmitRModelResult {
  const diagnostics: Diagnostic[] = [];

  // Find the r-model attribute. Phase 14 — `spreadBinding` is the name-less
  // kind; guard before reading `.name`.
  const rModelAttr = element.attributes.find(
    (a) =>
      a.kind !== 'spreadBinding' &&
      (a.name === 'r-model' || a.name === 'r-model:value'),
  );
  if (!rModelAttr) return { replacementAttributes: [], diagnostics };

  // Get the model target expression.
  if (rModelAttr.kind !== 'binding') {
    return { replacementAttributes: [], diagnostics };
  }

  const target = resolveModelTarget(rModelAttr.expression, ir);
  if (!target) {
    // Unrecognised target — leave r-model as-is for v1.
    return { replacementAttributes: [], diagnostics };
  }

  const { local, setter } = target;
  const tag = element.tagName.toLowerCase();
  const inputType = (getStaticAttr(element.attributes, 'type') ?? 'text').toLowerCase();

  // Phase 12 — the resolved `r-model` modifier chain. `valueTransforms` are
  // the ordered `$v`-placeholder fragments (already D-07-canonicalized);
  // `isLazy` flags `.lazy`. Both are empty/false for bare `r-model`, so the
  // non-modifier paths below stay byte-identical to pre-phase.
  const { valueTransforms, isLazy, resultType } = partitionModifiers(rModelAttr.modifiers);

  // Build babel nodes for replacement attribute expressions.
  // Each replacement attribute is encoded with a binding expression that
  // will pass through rewriteTemplateExpression unchanged (since we use
  // bare identifiers without the $-prefix).
  const localId = t.identifier(local);
  const setterId = t.identifier(setter);
  const eId = t.identifier('e');
  const eTargetValue = t.memberExpression(
    t.memberExpression(eId, t.identifier('target')),
    t.identifier('value'),
  );
  const eTargetChecked = t.memberExpression(
    t.memberExpression(eId, t.identifier('target')),
    t.identifier('checked'),
  );

  // Custom component (capitalized): value + onValueChange
  if (isPascalCase(element.tagName)) {
    return {
      replacementAttributes: [
        makeBindingAttr(':value', localId),
        makeBindingAttr(':onValueChange', setterId),
      ],
      diagnostics,
    };
  }

  // <select> or <textarea> — value/onChange.
  // Phase 12: `.number`/`.trim` wrap the committed value; `.lazy` swaps to the
  // uncontrolled `defaultValue`+`onBlur` deferred-commit pattern (D-08).
  if (tag === 'select' || tag === 'textarea') {
    const committed = applyResultTypeCast(
      applyValueTransforms(eTargetValue, valueTransforms, diagnostics),
      resultType,
    );
    const handlerArrow = t.arrowFunctionExpression(
      [eId],
      t.callExpression(setterId, [committed]),
    );
    if (isLazy) {
      return {
        replacementAttributes: [
          // D-08 — React has no true `change` event, so `.lazy` emits an
          // uncontrolled deferred-commit input (documented parity edge case;
          // see docs/compatibility.md). Programmatic mid-edit writes to the
          // bound state are not reflected by an uncontrolled input.
          makeBindingAttr(':defaultValue', localId),
          makeBindingAttr(':onBlur', handlerArrow),
        ],
        diagnostics,
      };
    }
    return {
      replacementAttributes: [
        makeBindingAttr(':value', localId),
        makeBindingAttr(':onChange', handlerArrow),
      ],
      diagnostics,
    };
  }

  // <input type="checkbox">
  if (tag === 'input' && inputType === 'checkbox') {
    // CR-01 (12-REVIEW) — a value-transform modifier (.number/.trim/custom)
    // cannot apply to a checkbox: the bound value is the boolean `checked`
    // state, not a user-typed string. Phase 12's purpose is killing silent
    // drops, so emit a warning rather than discarding the modifier silently.
    // `.lazy` is exempt — `change` is already the checkbox commit event.
    if (valueTransforms.length > 0) {
      diagnostics.push({
        code: RozieErrorCode.RMODEL_MODIFIER_NOT_APPLICABLE,
        severity: 'warning',
        message:
          'Value-transform r-model modifiers (.number/.trim/custom) have no effect on <input type="checkbox"> — the bound value is the boolean `checked` state, not a coercible string.',
        loc: rModelAttr.sourceLoc,
        hint: 'Remove the modifier from this checkbox r-model. `.lazy` is fine (change is already the commit event).',
      });
    }
    const onChangeArrow = t.arrowFunctionExpression(
      [eId],
      t.callExpression(setterId, [eTargetChecked]),
    );
    return {
      replacementAttributes: [
        makeBindingAttr(':checked', localId),
        makeBindingAttr(':onChange', onChangeArrow),
      ],
      diagnostics,
    };
  }

  // <input type="radio" value="V">
  if (tag === 'input' && inputType === 'radio') {
    // CR-01 (12-REVIEW) — a value-transform modifier cannot apply to a radio:
    // the committed value is the fixed `value="V"` attribute the input
    // carries, not user-typed text. Emit a warning rather than a silent drop.
    if (valueTransforms.length > 0) {
      diagnostics.push({
        code: RozieErrorCode.RMODEL_MODIFIER_NOT_APPLICABLE,
        severity: 'warning',
        message:
          'Value-transform r-model modifiers (.number/.trim/custom) have no effect on <input type="radio"> — the committed value is the fixed `value` attribute, not a coercible string.',
        loc: rModelAttr.sourceLoc,
        hint: 'Remove the modifier from this radio r-model. `.lazy` is fine (change is already the commit event).',
      });
    }
    const radioValue = getStaticAttr(element.attributes, 'value') ?? '';
    const checkedExpr = t.binaryExpression(
      '===',
      localId,
      t.stringLiteral(radioValue),
    );
    const onChangeArrow = t.arrowFunctionExpression(
      [eId],
      t.callExpression(setterId, [t.stringLiteral(radioValue)]),
    );
    return {
      replacementAttributes: [
        makeBindingAttr(':checked', checkedExpr),
        makeBindingAttr(':onChange', onChangeArrow),
      ],
      diagnostics,
    };
  }

  // <input type="text"> (default for input).
  // Phase 12: `.number`/`.trim` wrap the committed value; `.lazy` swaps to the
  // uncontrolled `defaultValue`+`onBlur` deferred-commit pattern (D-08).
  const committedValue = applyResultTypeCast(
    applyValueTransforms(eTargetValue, valueTransforms, diagnostics),
    resultType,
  );
  const onChangeArrow = t.arrowFunctionExpression(
    [eId],
    t.callExpression(setterId, [committedValue]),
  );
  if (isLazy) {
    return {
      replacementAttributes: [
        // D-08 — React's `.lazy` is an uncontrolled `defaultValue`+`onBlur`
        // deferred-commit input (documented parity edge case; see
        // docs/compatibility.md). Programmatic mid-edit writes to the bound
        // state are not reflected by an uncontrolled input.
        makeBindingAttr(':defaultValue', localId),
        makeBindingAttr(':onBlur', onChangeArrow),
      ],
      diagnostics,
    };
  }
  return {
    replacementAttributes: [
      makeBindingAttr(':value', localId),
      makeBindingAttr(':onChange', onChangeArrow),
    ],
    diagnostics,
  };
}

/**
 * emitRModel — Solid target (P2 complete implementation).
 *
 * Lowers a TemplateElement's `r-model="$data.X"` (or `$props.X` for model:true)
 * binding into the Solid controlled-input pattern.
 *
 * KEY SOLID DIFFERENCES from React emitRModel:
 *   - Text inputs use `onInput` not `onChange` (Solid's onChange fires on blur, not per-keystroke)
 *   - Signal reads need `()` getter call: `value()` not `value`
 *   - The setter call uses Solid signal setter: `setX($event.currentTarget.value)`
 *   - Custom components: `value={value()} onValueChange={setValue}`
 *
 * Patterns:
 *   - <input type="text"> (default) → `value={X()} onInput={($event) => setX($event.currentTarget.value)}`
 *   - <input type="checkbox">       → `checked={X()} onChange={($event) => setX($event.currentTarget.checked)}`
 *   - <input type="radio" value="V">→ `checked={X() === 'V'} onChange={($event) => setX('V')}`
 *   - <select>                       → `value={X()} onInput={($event) => setX($event.currentTarget.value)}`
 *   - <textarea>                     → `value={X()} onInput={($event) => setX($event.currentTarget.value)}`
 *   - <CustomComponent>              → `value={X()} onValueChange={setX}`
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
import { isPascalCase } from '../../../../core/src/ir/utils/isPascalCase.js';

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
 *   - `$data.query` → { local: 'query', setter: 'setQuery', isSignal: true }
 *   - `$props.value` (model:true) → { local: 'value', setter: 'setValue', isSignal: true }
 *
 * Both use signal-getter form in templates: `local()` in JSX.
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
  replacementAttributes: AttributeBinding[];
  diagnostics: Diagnostic[];
}

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
 * orthogonal concerns the emitter handles (mirrors the React emitter):
 *   - `valueTransforms`: ordered `$v`-placeholder code fragments (already
 *     D-07-canonicalized: `.trim` -> custom -> `.number` terminal).
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 */
function partitionModifiers(
  modifiers: ResolvedModelModifier[] | undefined,
): { valueTransforms: string[]; isLazy: boolean } {
  const valueTransforms: string[] = [];
  let isLazy = false;
  for (const m of modifiers ?? []) {
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
  }
  return { valueTransforms, isLazy };
}

/**
 * Phase 12 — apply the resolved `valueTransform` fragments to a value-access
 * expression node. Each fragment is a string containing the literal `$v`
 * placeholder (D-03); substitute `$v` with the current expression source,
 * re-parse, and chain. Empty list ⇒ the input node is returned unchanged, so
 * non-modifier `r-model` stays byte-identical to pre-phase. A malformed
 * fragment fails the parse loudly (threat register T-12-07).
 */
function applyValueTransforms(
  valueAccess: t.Expression,
  valueTransforms: string[],
): t.Expression {
  let current = valueAccess;
  for (const fragment of valueTransforms) {
    const currentSrc = generate(current, GEN_OPTS).code;
    current = parseExpression(fragment.split('$v').join(`(${currentSrc})`));
  }
  return current;
}

/**
 * Emit r-model lowering for Solid. Returns replacement attributes.
 *
 * Signal getter: we emit `X()` by wrapping the identifier in a CallExpression.
 * The resulting AttributeBinding with `kind: 'binding'` will pass through
 * rewriteTemplateExpression, which will NOT double-call it (since the expression
 * is already a call, not a bare $data.X member expression).
 */
export function emitRModel(
  element: TemplateElementIR,
  ir: IRComponent,
): EmitRModelResult {
  const diagnostics: Diagnostic[] = [];

  const rModelAttr = element.attributes.find(
    (a) => a.name === 'r-model' || a.name === 'r-model:value',
  );
  if (!rModelAttr) return { replacementAttributes: [], diagnostics };
  if (rModelAttr.kind !== 'binding') return { replacementAttributes: [], diagnostics };

  const target = resolveModelTarget(rModelAttr.expression, ir);
  if (!target) return { replacementAttributes: [], diagnostics };

  const { local, setter } = target;
  const tag = element.tagName.toLowerCase();
  const inputType = (getStaticAttr(element.attributes, 'type') ?? 'text').toLowerCase();

  // Phase 12 — the resolved `r-model` modifier chain. `valueTransforms` are
  // the ordered `$v`-placeholder fragments (D-07-canonicalized); `isLazy`
  // flags `.lazy`. Both are empty/false for bare `r-model`.
  const { valueTransforms, isLazy } = partitionModifiers(rModelAttr.modifiers);

  // Build Babel nodes for replacement attributes.
  // Signal getter: local() — use a CallExpression so it passes through rewriteTemplateExpression
  // without being double-rewritten (the expression is a CallExpression, not a MemberExpression
  // starting with $data or $props).
  const localCallExpr = t.callExpression(t.identifier(local), []);
  const setterId = t.identifier(setter);
  const eId = t.identifier('e');

  // Custom component (PascalCase): value={value()} onValueChange={setValue}
  if (isPascalCase(element.tagName)) {
    return {
      replacementAttributes: [
        makeBindingAttr(':value', localCallExpr),
        makeBindingAttr(':onValueChange', setterId),
      ],
      diagnostics,
    };
  }

  // <input type="checkbox">: checked={X()} onChange={($event) => setX($event.currentTarget.checked)}
  if (tag === 'input' && inputType === 'checkbox') {
    const eTargetChecked = t.memberExpression(
      t.memberExpression(eId, t.identifier('currentTarget')),
      t.identifier('checked'),
    );
    const onChangeArrow = t.arrowFunctionExpression(
      [eId],
      t.callExpression(setterId, [eTargetChecked]),
    );
    return {
      replacementAttributes: [
        makeBindingAttr(':checked', localCallExpr),
        makeBindingAttr(':onChange', onChangeArrow),
      ],
      diagnostics,
    };
  }

  // <input type="radio" value="V">: checked={X() === 'V'} onChange={($event) => setX('V')}
  if (tag === 'input' && inputType === 'radio') {
    const radioValue = getStaticAttr(element.attributes, 'value') ?? '';
    const checkedExpr = t.binaryExpression(
      '===',
      localCallExpr,
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

  // <select>, <textarea>, <input type="text"> (default):
  // value={X()} onInput={($event) => setX($event.currentTarget.value)}
  // Solid's onInput fires on every keystroke; onChange fires on blur.
  //
  // Phase 12: `.number`/`.trim` wrap the committed value; `.lazy` swaps the
  // event from `onInput` to `onChange` (D-08 — in Solid `onChange` IS the
  // native change event, so no React-style uncontrolled-input workaround).
  const eTargetValue = t.memberExpression(
    t.memberExpression(eId, t.identifier('currentTarget')),
    t.identifier('value'),
  );
  const committedValue = applyValueTransforms(eTargetValue, valueTransforms);
  const handlerArrow = t.arrowFunctionExpression(
    [eId],
    t.callExpression(setterId, [committedValue]),
  );
  return {
    replacementAttributes: [
      makeBindingAttr(':value', localCallExpr),
      makeBindingAttr(isLazy ? ':onChange' : ':onInput', handlerArrow),
    ],
    diagnostics,
  };
}

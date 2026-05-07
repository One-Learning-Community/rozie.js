/**
 * emitRModel — Solid target (P2 complete implementation).
 *
 * Lowers a TemplateElement's `r-model="$data.X"` (or `$props.X` for model:true)
 * binding into the Solid controlled-input pattern.
 *
 * KEY SOLID DIFFERENCES from React emitRModel:
 *   - Text inputs use `onInput` not `onChange` (Solid's onChange fires on blur, not per-keystroke)
 *   - Signal reads need `()` getter call: `value()` not `value`
 *   - The setter call uses Solid signal setter: `setX(e.currentTarget.value)`
 *   - Custom components: `value={value()} onValueChange={setValue}`
 *
 * Patterns:
 *   - <input type="text"> (default) → `value={X()} onInput={(e) => setX(e.currentTarget.value)}`
 *   - <input type="checkbox">       → `checked={X()} onChange={(e) => setX(e.currentTarget.checked)}`
 *   - <input type="radio" value="V">→ `checked={X() === 'V'} onChange={(e) => setX('V')}`
 *   - <select>                       → `value={X()} onInput={(e) => setX(e.currentTarget.value)}`
 *   - <textarea>                     → `value={X()} onInput={(e) => setX(e.currentTarget.value)}`
 *   - <CustomComponent>              → `value={X()} onValueChange={setX}`
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type {
  IRComponent,
  TemplateElementIR,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { isPascalCase } from '../../../../core/src/ir/utils/isPascalCase.js';

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

  // <input type="checkbox">: checked={X()} onChange={(e) => setX(e.currentTarget.checked)}
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

  // <input type="radio" value="V">: checked={X() === 'V'} onChange={(e) => setX('V')}
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
  // value={X()} onInput={(e) => setX(e.currentTarget.value)}
  // Solid's onInput fires on every keystroke; onChange fires on blur.
  const eTargetValue = t.memberExpression(
    t.memberExpression(eId, t.identifier('currentTarget')),
    t.identifier('value'),
  );
  const onInputArrow = t.arrowFunctionExpression(
    [eId],
    t.callExpression(setterId, [eTargetValue]),
  );
  return {
    replacementAttributes: [
      makeBindingAttr(':value', localCallExpr),
      makeBindingAttr(':onInput', onInputArrow),
    ],
    diagnostics,
  };
}

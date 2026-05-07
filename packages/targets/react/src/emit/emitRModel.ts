/**
 * emitRModel — Plan 04-03 Task 3 (React target).
 *
 * Lowers a TemplateElement's `r-model="$data.X"` (or `$props.X` for model:true)
 * binding into the React controlled-input pattern per RESEARCH Pattern 7.
 *
 * Patterns (chosen by element tag + type):
 *   - <input type="text"> (default) → value={X} onChange={(e) => setX(e.target.value)}
 *   - <input type="checkbox">       → checked={X} onChange={(e) => setX(e.target.checked)}
 *   - <input type="radio" value="V">→ checked={X === 'V'} onChange={(e) => setX('V')}
 *   - <select>                       → value={X} onChange={(e) => setX(e.target.value)}
 *   - <textarea>                     → value={X} onChange={(e) => setX(e.target.value)}
 *   - <CustomComponent>              → value={X} onValueChange={setX}
 *
 * The setter name comes from looking up X's StateDecl/PropDecl in the IR.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type {
  IRComponent,
  TemplateElementIR,
  AttributeBinding,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
// Phase 06.2 P1 D-116 — shared PascalCase predicate. Replaces the local
// isCustomComponent fn so IR lowering and per-target emit cannot drift.
import { isPascalCase } from '../../../../core/src/ir/utils/isPascalCase.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

void generate;

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };
void GEN_OPTS;

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

  // Find the r-model attribute.
  const rModelAttr = element.attributes.find(
    (a) => a.name === 'r-model' || a.name === 'r-model:value',
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

  // <select> or <textarea> — value/onChange
  if (tag === 'select' || tag === 'textarea') {
    const onChangeArrow = t.arrowFunctionExpression(
      [eId],
      t.callExpression(setterId, [eTargetValue]),
    );
    return {
      replacementAttributes: [
        makeBindingAttr(':value', localId),
        makeBindingAttr(':onChange', onChangeArrow),
      ],
      diagnostics,
    };
  }

  // <input type="checkbox">
  if (tag === 'input' && inputType === 'checkbox') {
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

  // <input type="text"> (default for input)
  const onChangeArrow = t.arrowFunctionExpression(
    [eId],
    t.callExpression(setterId, [eTargetValue]),
  );
  return {
    replacementAttributes: [
      makeBindingAttr(':value', localId),
      makeBindingAttr(':onChange', onChangeArrow),
    ],
    diagnostics,
  };
}

/**
 * computeHelperDeps — Plan 04-04 Wave 0 spike Variant A support.
 *
 * Walk a top-level helper's body (arrow / function expression) and collect
 * the SignalRef[] it reads from the surrounding component scope. Unlike
 * Phase 2's `computeExpressionDeps`, this function operates POST-IR-lowering
 * over the React-cloned program (so it can be called inside the React
 * emitter without re-running Phase 2).
 *
 * Resolution rules (matches Phase 2 D-21 contract verbatim):
 *   - `$props.foo` (model)         → { scope: 'props', path: ['foo'] }
 *   - `$props.foo` (non-model)     → { scope: 'props', path: ['foo'] }
 *   - `$data.foo`                  → { scope: 'data', path: ['foo'] }
 *   - `$refs.foo`                  → SKIP (refs stable per D-21b)
 *   - `$slots.foo`                 → { scope: 'slots', path: ['foo'] }
 *   - `$emit` / `$el`              → SKIP (stable identifiers)
 *   - bare identifier matching computed name → { scope: 'computed', path: [name] }
 *   - bare identifier matching another helper name → { scope: 'closure', identifier }
 *   - bare identifier shadowed by helper params → SKIP
 *
 * Output is sorted lexically for snapshot stability (matching renderDepArray).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { Scope } from '@babel/traverse';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { SignalRef } from '../../../../core/src/reactivity/signalRef.js';

// CJS-ESM interop normalization (matches rewriteTemplateExpression).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const STABLE_IDENTIFIERS = new Set(['$emit', '$el']);
const MAGIC_ACCESSOR_NAMES = new Set(['$props', '$data', '$refs', '$slots']);

/**
 * Compute the SignalRef[] read inside `helperBody`. Helper params (and any
 * locally-declared bindings inside the helper body) are excluded.
 *
 * @param helperBody - the BlockStatement or Expression body of the helper
 * @param ir - the full IR (for prop/data/computed/ref/slot name lookups)
 * @param helperNames - set of all top-level helper identifiers (so a call
 *   to another helper inside this body is recorded as `closure: <name>`)
 * @param ownName - the helper's own name (skipped to avoid self-deps)
 */
export function computeHelperBodyDeps(
  helperBody: t.Node,
  ir: IRComponent,
  helperNames: Set<string>,
  ownName: string,
): SignalRef[] {
  const out: SignalRef[] = [];
  const seen = new Set<string>();
  const push = (ref: SignalRef): void => {
    const key =
      ref.scope === 'closure'
        ? `closure::${ref.identifier}`
        : `${ref.scope}::${ref.path.join('.')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  };

  const propNames = new Set(ir.props.map((p) => p.name));
  // Emits become synthesised `onX` prop fields (camelCase + on-prefix per
  // emitPropsInterface). Recognize them as prop reads so e.g. `props.onClose`
  // gets tracked as a dep.
  function emitNameToOnPropName(emitName: string): string {
    const parts = emitName.split(/[-_]/).filter(Boolean);
    if (parts.length === 0) return 'on';
    const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return 'on' + camel;
  }
  const onPropNames = new Set(ir.emits.map(emitNameToOnPropName));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));

  // Wrap the body in a File so traverse() works for either Expression or
  // BlockStatement input. Use a synthetic FunctionDeclaration wrapper so
  // local bindings (params, vars) are properly scoped.
  const wrappedBody: t.BlockStatement = t.isBlockStatement(helperBody)
    ? helperBody
    : t.blockStatement([t.expressionStatement(helperBody as t.Expression)]);
  const wrappedFn = t.functionDeclaration(
    t.identifier('__helper'),
    [],
    wrappedBody,
    false,
    false,
  );
  const file = t.file(t.program([wrappedFn]));

  /**
   * Determine if an identifier path is bound LOCALLY (param/var/let/const
   * inside the helper). We use the Babel scope chain to detect this
   * — local bindings shadow the component-scope reactive bindings.
   */
  function isLocallyBound(scope: Scope | null, name: string): boolean {
    if (!scope) return false;
    const binding = scope.getBinding(name);
    if (!binding) return false;
    // If the binding's scope is at or below our wrappedFn (function body),
    // it's a local — shadowing component scope. The wrappedFn is the
    // outermost scope here (top-level FunctionDeclaration), so any binding
    // we find via scope.getBinding is local.
    return true;
  }

  // Helpers that this walker is invoked over have ALREADY been rewritten by
  // rewriteRozieIdentifiers, so accesses look like `props.foo` (NOT `$props.foo`),
  // `foo` for $data/$model/computed (collapsed to bare locals), and `foo.current`
  // for $refs. We accept BOTH forms to remain defensive in case the walker is
  // ever invoked over an un-rewritten program.
  traverse(file, {
    MemberExpression(path) {
      const node = path.node;
      if (path.node.computed) return;
      if (!t.isIdentifier(node.object) || !t.isIdentifier(node.property)) return;
      const obj = node.object.name;
      const prop = node.property.name;

      // Original $-prefixed form
      if (obj === '$props' && propNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$data' && dataNames.has(prop)) {
        push({ scope: 'data', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$slots' && slotNames.has(prop)) {
        push({ scope: 'slots', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$refs' && refNames.has(prop)) {
        // Refs are stable — skip per D-21b.
        path.skip();
        return;
      }
      // Rewritten React-side form: `props.foo` (non-model props).
      if (obj === 'props' && propNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      // Synthesised emit-prop: `props.onClose` etc.
      if (obj === 'props' && onPropNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      // `props.children` / `props.renderHeader` — slot reads via render-prop fields.
      if (obj === 'props' && (prop === 'children' || prop.startsWith('render'))) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      // Rewritten React-side form: `<refName>.current` — refs stable.
      if (refNames.has(obj) && prop === 'current') {
        path.skip();
        return;
      }
    },

    OptionalMemberExpression(path) {
      const node = path.node;
      if (node.computed) return;
      if (!t.isIdentifier(node.object) || !t.isIdentifier(node.property)) return;
      const obj = node.object.name;
      const prop = node.property.name;
      if (obj === '$props' && propNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$data' && dataNames.has(prop)) {
        push({ scope: 'data', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$slots' && slotNames.has(prop)) {
        push({ scope: 'slots', path: [prop] });
        path.skip();
        return;
      }
      if (obj === '$refs' && refNames.has(prop)) {
        path.skip();
        return;
      }
      if (obj === 'props' && propNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      if (obj === 'props' && onPropNames.has(prop)) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      if (obj === 'props' && (prop === 'children' || prop.startsWith('render'))) {
        push({ scope: 'props', path: [prop] });
        path.skip();
        return;
      }
      if (refNames.has(obj) && prop === 'current') {
        path.skip();
        return;
      }
    },

    Identifier(path) {
      const name = path.node.name;
      if (name === ownName) return;
      if (STABLE_IDENTIFIERS.has(name)) return;
      if (MAGIC_ACCESSOR_NAMES.has(name)) return;
      // 'props' as a member-expression OBJECT is handled by MemberExpression.
      // Skip when it appears bare (rare; would be a `props` reference outside
      // member access, which we can't precisely narrow without scope info).
      if (name === 'props') return;

      // Skip property positions in MemberExpressions (handled above).
      if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed) {
        return;
      }
      if (
        t.isOptionalMemberExpression(path.parent) &&
        path.parent.property === path.node &&
        !path.parent.computed
      ) {
        return;
      }
      // Skip declaration positions and object property keys.
      if (t.isVariableDeclarator(path.parent) && path.parent.id === path.node) return;
      if (
        t.isObjectProperty(path.parent) &&
        path.parent.key === path.node &&
        !path.parent.computed
      ) {
        return;
      }
      if (t.isFunctionDeclaration(path.parent) && path.parent.id === path.node) return;
      if (t.isFunctionExpression(path.parent) && path.parent.id === path.node) return;

      // Local binding shadow check.
      if (isLocallyBound(path.scope, name)) return;

      // React-side setter handling.
      //   - `useState` setter (`setX` from `const [x, setX] = useState(...)`)
      //     is recognized as stable by `react-hooks/exhaustive-deps` —
      //     `isStableKnownHookValue`. We can SKIP it from deps[].
      //   - `useControllableState` setter is identity-stable in our runtime
      //     impl (refs + useCallback(...,[])) BUT eslint doesn't have a
      //     hardcoded known-stable entry for it. Per Plan 04-04 acceptance:
      //     INCLUDE it in deps[] so exhaustive-deps lint passes. The runtime
      //     cost (rare re-creation of close on parent rerender) is minor and
      //     acceptable for v1 — see Plan 04-04 SUMMARY "Known Limitations".
      if (name.startsWith('set') && name.length > 3) {
        const candidate = name.charAt(3).toLowerCase() + name.slice(4);
        if (dataNames.has(candidate)) return;
        // model-prop setter — record as closure dep (not provably stable to lint)
        const isModelSetter = ir.props.some(
          (p) => p.isModel && p.name === candidate,
        );
        if (isModelSetter) {
          push({ scope: 'closure', identifier: name });
          return;
        }
      }

      // Bare data name (rewritten from $data.foo to foo)
      if (dataNames.has(name)) {
        push({ scope: 'data', path: [name] });
        return;
      }
      // Bare model-prop name (rewritten from $props.value to value)
      const modelProp = ir.props.find((p) => p.isModel && p.name === name);
      if (modelProp) {
        push({ scope: 'props', path: [name] });
        return;
      }
      // Match against computed / helper names.
      if (computedNames.has(name)) {
        push({ scope: 'computed', path: [name] });
        return;
      }
      if (helperNames.has(name)) {
        push({ scope: 'closure', identifier: name });
        return;
      }
      // Otherwise: not a reactive read (e.g., global like console, Object,
      // setTimeout — or React hook setters whose stability is implied via
      // their useState origin; our emitter never lists them in deps[]).
    },
  });

  return out;
}

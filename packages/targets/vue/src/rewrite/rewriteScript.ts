/**
 * rewriteRozieIdentifiers — Phase 3 Plan 02 Task 1.
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into Vue-3.4-idiomatic identifier shapes:
 *
 *   - `$props.value`  (model)     → `value.value`     (D-31 — defineModel returns Ref<T>)
 *   - `$props.step`   (non-model) → `props.step`      (D-31 — withDefaults(defineProps<>(),{...}))
 *   - `$data.hovering`            → `hovering.value`  (D-32 — per-decl ref())
 *   - `$refs.dialogEl`            → `dialogElRef.value` (Pitfall 4 — Ref suffix avoids name collisions)
 *   - `$emit('change', x)`        → `emit('change', x)` (defineEmits emits via local emit handle)
 *   - bare reads of computed-name → `name.value`      (computed() returns Ref<T>)
 *
 * `$onMount`/`$onUnmount`/`$onUpdate` calls are NOT mutated by this pass —
 * they're consumed STRUCTURALLY from `ir.lifecycle` by emitScript (Task 2).
 * The residual-script-body emit step skips the matching ExpressionStatements
 * via the SetupAnnotation kind tags from Phase 2.
 *
 * Pitfall 4 collision detection: before traversal, build sets of
 * { dataNames, computedNames, modelProps, nonModelProps, refNames }; if any
 * RefDecl name appears in another set, push a ROZ420 diagnostic.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input — push
 * to `diagnostics` array.
 *
 * Per Phase 2 D-T-2-01-04 CJS-interop pattern: normalize `@babel/traverse`
 * default-export at import time.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * @param program - the CLONED Babel File (callers must `cloneScriptProgram` first)
 * @param ir - the IRComponent (used for prop/data/ref/computed name lookups)
 * @param diagnostics - collected-not-thrown sink for ROZ420 collision diagnostics
 */
export function rewriteRozieIdentifiers(
  program: t.File,
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));

  // Phase 06.1 P2 (D-104/D-106): build name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));
  const computedByName = new Map(ir.computed.map((c) => [c.name, c]));

  // Pitfall 4: detect template-ref name collisions with <data>/<computed>/<props>.
  for (const ref of ir.refs) {
    const collides =
      dataNames.has(ref.name) ||
      computedNames.has(ref.name) ||
      modelProps.has(ref.name) ||
      nonModelProps.has(ref.name);
    if (collides) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_VUE_RESERVED, // ROZ420
        severity: 'error',
        message: `Template ref '${ref.name}' collides with <data>/<computed>/<props> declaration of the same name. Rename one to avoid the collision in emitted Vue output.`,
        loc: ref.sourceLoc,
      });
    }
  }

  traverse(program, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      // Skip computed access (`$props['foo']`) — Phase 2 ROZ106 already warned.
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value.value
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const newObj = t.identifier(prop.name);
          if (propDecl) newObj.loc = propDecl.sourceLoc as any;
          path.node.object = newObj;
          path.node.property = t.identifier('value');
        } else if (nonModelProps.has(prop.name)) {
          // $props.step → props.step
          path.node.object = t.identifier('props');
          // property stays as-is
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering.value
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (stateDecl) newObj.loc = stateDecl.sourceLoc as any;
        path.node.object = newObj;
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogElRef.value (Pitfall 4 Ref suffix)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name + 'Ref');
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        path.node.object = newObj;
        path.node.property = t.identifier('value');
        return;
      }
    },

    OptionalMemberExpression(path) {
      // Same rewrites for `$refs.foo?.bar` / `$data.foo?.bar` patterns.
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          path.node.object = t.identifier(prop.name);
          path.node.property = t.identifier('value');
        } else if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name);
        path.node.property = t.identifier('value');
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.node.object = t.identifier(prop.name + 'Ref');
        path.node.property = t.identifier('value');
        return;
      }
    },

    CallExpression(path) {
      // $emit('foo', x) → emit('foo', x). Do NOT touch $onMount/$onUnmount/$onUpdate
      // (those are consumed structurally from ir.lifecycle by emitScript).
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === '$emit') {
        path.node.callee = t.identifier('emit');
      }
    },

    Identifier(path) {
      // Bare reads of a $computed name need `.value` appended.
      // Skip:
      //   - Identifiers in declarator id position (`const X = ...`)
      //   - Identifiers in property position of MemberExpression (already handled / N/A)
      //   - Identifiers being the `object` we just rewrote into (e.g. `value.value` —
      //     the new `value` Identifier should NOT also get .value).
      const name = path.node.name;
      if (!computedNames.has(name)) return;

      const parent = path.parent;

      // Skip declarator id (`const canIncrement = ...`).
      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;

      // Skip property of MemberExpression (`x.canIncrement` — not a bare read of the computed).
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }

      // Skip object of MemberExpression that was JUST rewritten by us — but
      // since our rewrites construct fresh `t.identifier(...)` nodes, those
      // new identifiers have no relation to the visitor's path. They will be
      // visited as part of the post-replacement traversal IF the traverser
      // re-visits, but @babel/traverse generally does not revisit replaced nodes
      // automatically unless `path.replaceWith(...)` is used. We use direct
      // mutation (`path.node.object = ...`), so revisits do happen. Guard by
      // checking the parent again: if the parent is a MemberExpression and we
      // are its object, AND the property is named 'value', AND the value-wrap
      // was applied by our pass (heuristic: parent has the new shape), skip.
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.object === path.node &&
        !parent.computed &&
        t.isIdentifier(parent.property) &&
        parent.property.name === 'value'
      ) {
        // Already wrapped — `canIncrement.value` is intentional.
        return;
      }

      // Skip object-key shorthand position (`{ canIncrement }` — that's an Identifier
      // in property position of an ObjectProperty with `shorthand: true`).
      if (t.isObjectProperty(parent) && parent.key === path.node && parent.shorthand) {
        // Convert shorthand to long-form: `{ canIncrement }` → `{ canIncrement: canIncrement.value }`.
        // For v1 we leave shorthand alone — it's rare in Rozie idiom and would silently
        // change semantics. If users hit this, they'll get a typescript error
        // pointing at the .value-less reference, which is acceptable for v1.
        return;
      }

      // Skip function-name position (function declarations).
      if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;

      // Skip parameter binding positions.
      if (t.isFunction(parent) && parent.params.includes(path.node)) return;
      // import / export specifier identifier positions.
      if (t.isImportSpecifier(parent)) return;
      if (t.isExportSpecifier(parent)) return;

      // Skip LHS of assignment in declarator — already handled above.
      // Skip when path is the labeledStatement label, throw target, etc.
      if (t.isLabeledStatement(parent) && parent.label === path.node) return;

      // Replace `canIncrement` with `canIncrement.value`.
      // Phase 06.1 P2 D-104/D-106: anchor synth member-expression loc to the
      // IR ComputedDecl that produced this identifier.
      const computedDecl = computedByName.get(name);
      const synthId = t.identifier(name);
      if (computedDecl) synthId.loc = computedDecl.sourceLoc as any;
      const synthMember = t.memberExpression(synthId, t.identifier('value'));
      if (computedDecl) synthMember.loc = computedDecl.sourceLoc as any;
      path.replaceWith(synthMember);
      path.skip();
    },
  });
}

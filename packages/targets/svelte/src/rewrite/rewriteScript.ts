/**
 * rewriteScript — Phase 5 Plan 02a Task 1.
 *
 * Walks a CLONED Babel Program and rewrites Rozie magic accessors into
 * Svelte 5 idiomatic identifier shapes. Svelte's rewrite is the SIMPLEST of
 * all targets — runes destructure props/state/refs as bare locals, so every
 * `$foo.bar` accessor strips the `$foo.` prefix:
 *
 *   - `$props.value`  (model)     → `value`     (let { value = $bindable(...) })
 *   - `$props.step`   (non-model) → `step`      (let { step = ... })
 *   - `$data.hovering`            → `hovering`  (let hovering = $state(...))
 *   - `$refs.dialogEl`            → `dialogEl`  (let dialogEl = $state<HTMLElement>())
 *   - `$slots.foo`                → `foo`       (let { foo } = $props())
 *   - `$emit('foo', x)`           → `onfoo?.(x)` (Svelte 5 callback prop convention)
 *
 * Per RESEARCH.md Pitfall 7: do NOT optimize `items = [...items, newItem]`
 * to `items.push(newItem)` — preserve the re-assignment shape. We don't
 * touch AssignmentExpression node-types here, so re-assignment is preserved
 * by default.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
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
 * @param program     - the CLONED Babel File (callers must `cloneScriptProgram` first)
 * @param ir          - the IRComponent (used for prop/data/ref/computed name lookups)
 * @param diagnostics - collected-not-thrown sink for ROZ621 collision diagnostics
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
  // Computed names are NOT rewritten in Svelte: derived reads stay bare
  // (Svelte 5 auto-tracks signal reads — no `.value` suffix). Kept here as a
  // documentation anchor; not used in any visitor.
  const computedNames = new Set(ir.computed.map((c) => c.name));
  void computedNames;
  const slotNames = new Set(ir.slots.map((s) => (s.name === '' ? 'default' : s.name)));

  // Detect template-ref name collisions with <data>/<computed>/<props> — same
  // posture as the Vue target (ROZ420) but using ROZ621 (Svelte's reserved code).
  for (const ref of ir.refs) {
    const collides =
      dataNames.has(ref.name) ||
      computedNames.has(ref.name) ||
      modelProps.has(ref.name) ||
      nonModelProps.has(ref.name);
    if (collides) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_SVELTE_RESERVED, // ROZ621
        severity: 'error',
        message: `Template ref '${ref.name}' collides with <data>/<computed>/<props> declaration of the same name. Rename one to avoid the collision in emitted Svelte output.`,
        loc: ref.sourceLoc,
      });
    }
  }

  traverse(program, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      // Skip computed access (`$props['foo']`).
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          // $props.value → value (bare local — destructured from $props())
          path.replaceWith(t.identifier(prop.name));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (bare local — let hovering = $state(...))
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogEl (no Ref suffix in Svelte — refs are bare lets)
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // $slots.header → header (Snippet prop destructured from $props())
        path.replaceWith(t.identifier(prop.name));
        path.skip();
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
        if (modelProps.has(prop.name) || nonModelProps.has(prop.name)) {
          path.replaceWith(t.identifier(prop.name));
          path.skip();
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        path.replaceWith(t.identifier(prop.name));
        path.skip();
        return;
      }
    },

    CallExpression(path) {
      // $emit('foo', x) → onfoo?.(x) — Svelte 5 callback-prop convention.
      // Do NOT touch $onMount/$onUnmount/$onUpdate (consumed structurally
      // from ir.lifecycle by emitScript).
      const callee = path.node.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$emit') return;
      const args = path.node.arguments;
      if (args.length === 0) return;
      const first = args[0];
      if (!t.isStringLiteral(first)) return;
      // Replace with optional-call: onfoo?.(restArgs). Do NOT path.skip() —
      // remaining args may contain nested $data/$props/$refs MemberExpressions
      // that still need rewriting (babel will re-traverse the replaced node).
      const callbackName = `on${first.value}`;
      const rest = args.slice(1);
      const optCall = t.optionalCallExpression(
        t.identifier(callbackName),
        rest as t.Expression[],
        true,
      );
      path.replaceWith(optCall);
    },
  });
}

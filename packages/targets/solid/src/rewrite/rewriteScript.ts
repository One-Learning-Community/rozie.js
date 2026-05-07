/**
 * rewriteRozieIdentifiers — Solid target variant (P1 stub).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into Solid-idiomatic identifier shapes. Mirrors the React target's
 * rewriteScript.ts module structure.
 *
 * P1 STATUS: This module provides a minimal rewrite that satisfies the
 * import graph and allows emitSolid to produce parseable TSX. Full Solid
 * signal-getter convention (`$data.count` → `count()`) is deferred to P2.
 *
 * TODO(P2): Map $data.x → x() (Solid signal getter convention).
 * TODO(P2): Map $data.x = v → setX(v) (Solid signal setter convention).
 * TODO(P2): Map $props.x (model: true) → createControllableSignal accessor.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
}

/**
 * P1 minimal rewrite: removes the $props / $data / $refs / $emit prefixes
 * so the program body can still be emitted as valid TS without Rozie-specific
 * identifiers leaking into output.
 *
 * P2 will replace these with Solid-correct forms (signal getters, setters, etc.)
 */
export function rewriteRozieIdentifiers(
  cloned: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  traverse(cloned, {
    MemberExpression(path) {
      const { object, property, computed } = path.node;
      if (computed) return;
      if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;

      // $props.x → local.x (P1 shim — P2 will split into controlled/uncontrolled)
      if (object.name === '$props') {
        path.replaceWith(
          t.memberExpression(t.identifier('local'), property),
        );
        return;
      }

      // $data.x → x (P1: bare local; P2 will add () for signal getter)
      if (object.name === '$data') {
        path.replaceWith(t.identifier(property.name));
        return;
      }

      // $refs.x → xRef (P1 shim for ref variable names)
      if (object.name === '$refs') {
        path.replaceWith(t.identifier(property.name + 'Ref'));
        return;
      }
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $emit('event', args) → props.onEvent?.(args)
      if (callee.name === '$emit') {
        const args = path.node.arguments;
        const eventArg = args[0];
        if (!eventArg || !t.isStringLiteral(eventArg)) return;
        const eventName = eventArg.value;
        const parts = eventName.split(/[-_]/).filter(Boolean);
        const pascalName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        const propName = 'on' + pascalName;
        const restArgs = args.slice(1);
        path.replaceWith(
          t.optionalCallExpression(
            t.optionalMemberExpression(
              t.identifier('local'),
              t.identifier(propName),
              false,
              true,
            ),
            restArgs as t.Expression[],
            false,
          ),
        );
      }
    },
  });

  void ir; // ir available for P2 model-prop set construction
  return { rewrittenProgram: cloned, diagnostics };
}

/**
 * Order the React component body so no statement reads a `const` / `let` /
 * `class` binding before its declaration has run (a TDZ ReferenceError on the
 * first render).
 *
 * The body is assembled from sections (state hooks, then the user's script,
 * then lifecycle effects), and inside the script `$computed` / `$memo` /
 * `useCallback` wraps keep their source position. Two shapes read a later
 * binding while rendering:
 *   - a `useCallback` whose dependency array names a `useCallback` declared
 *     further down (`const a = useCallback(() => b(), [b]); const b = …`);
 *   - a `$computed` (`useMemo`, run on the first render) that calls a `$memo`
 *     function whose cache `const` is declared further down.
 *
 * This pass computes, per top-level statement, the TDZ bindings it reads WHILE
 * the body runs: everything outside nested functions, plus the bodies of
 * functions run right away (`useMemo` / `useState` initialisers, IIFEs) and of
 * the body's own functions it calls (transitively). Statements are then placed
 * in a stable topological order: the earliest statement whose eager reads are
 * all declared goes next. When nothing reads ahead, the input is returned
 * byte for byte.
 */

import { parse } from '@babel/parser';
import type { NodePath, Scope } from '@babel/traverse';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : (_traverse as unknown as { default: TraverseFn }).default;

/** Hooks whose function argument runs during the render that calls them. */
const EAGER_CALLBACK_HOOKS = new Set(['useMemo', 'useState', 'useReducer']);

const PREFIX = 'function __rozieBody() {\n';

export function orderByEagerDeps(script: string): string {
  if (script.trim().length === 0) return script;
  let file: t.File;
  try {
    file = parse(`${PREFIX}${script}\n}`, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: false,
    });
  } catch {
    return script;
  }

  let bodyPath: NodePath<t.BlockStatement> | null = null;
  traverse(file, {
    FunctionDeclaration(p) {
      if (p.node.id?.name === '__rozieBody') {
        bodyPath = p.get('body');
        p.stop();
      }
    },
  });
  if (bodyPath === null) return script;
  const body: NodePath<t.BlockStatement> = bodyPath;
  const bodyScope = body.scope;
  const stmts = body.get('body');
  if (stmts.length < 2) return script;

  // Which statement declares each TDZ binding, and the callable bodies of the
  // body's own functions.
  const tdzOwner = new Map<string, number>();
  const callables = new Map<string, NodePath<t.Function>>();
  stmts.forEach((s, i) => {
    if (s.isVariableDeclaration()) {
      for (const d of s.get('declarations')) {
        for (const name of Object.keys(t.getBindingIdentifiers(d.node.id))) tdzOwner.set(name, i);
        const id = d.node.id;
        if (!t.isIdentifier(id)) continue;
        const init = d.get('init');
        if (init.isFunction()) callables.set(id.name, init);
        else if (init.isCallExpression()) {
          const callee = init.node.callee;
          const fn = init.get('arguments')[0];
          if (t.isIdentifier(callee) && callee.name === 'useCallback' && fn?.isFunction()) {
            callables.set(id.name, fn);
          }
        }
      }
    } else if (s.isClassDeclaration() && s.node.id) {
      tdzOwner.set(s.node.id.name, i);
    } else if (s.isFunctionDeclaration() && s.node.id) {
      callables.set(s.node.id.name, s);
    }
  });

  const isBodyBinding = (name: string, scope: Scope): boolean =>
    scope.getBinding(name)?.scope === bodyScope;

  // Reads (and calls) made by running `root`, not descending into functions
  // that are only created there.
  const direct = (root: NodePath): { reads: Set<string>; calls: Set<string> } => {
    const reads = new Set<string>();
    const calls = new Set<string>();
    const visitRef = (p: NodePath<t.Identifier>): void => {
      if (!p.isReferencedIdentifier()) return;
      const name = p.node.name;
      if (!isBodyBinding(name, p.scope)) return;
      reads.add(name);
      if (p.parentPath?.isCallExpression() && p.parentPath.node.callee === p.node) calls.add(name);
    };
    const visitor = {
      Function(p: NodePath<t.Function>) {
        if (p === root) return;
        if (!runsImmediately(p)) p.skip();
      },
      Identifier: visitRef,
    };
    if (root.isFunction()) {
      root.get('body').traverse(visitor);
    } else if (root.isIdentifier()) {
      visitRef(root);
    } else {
      root.traverse(visitor);
    }
    return { reads, calls };
  };

  // Everything calling a body function reads, transitively.
  const callReads = new Map<string, Set<string>>();
  const readsOfCall = (name: string, seen: Set<string>): Set<string> => {
    const cached = callReads.get(name);
    if (cached) return cached;
    const fn = callables.get(name);
    const out = new Set<string>();
    if (!fn || seen.has(name)) return out;
    seen.add(name);
    const { reads, calls } = direct(fn);
    for (const r of reads) out.add(r);
    for (const c of calls) for (const r of readsOfCall(c, seen)) out.add(r);
    callReads.set(name, out);
    return out;
  };

  const deps: Array<Set<number>> = stmts.map((s, i) => {
    const out = new Set<number>();
    if (s.isFunctionDeclaration()) return out;
    const { reads, calls } = direct(s);
    const all = new Set(reads);
    for (const c of calls) for (const r of readsOfCall(c, new Set())) all.add(r);
    for (const name of all) {
      const owner = tdzOwner.get(name);
      if (owner !== undefined && owner !== i) out.add(owner);
    }
    return out;
  });

  if (!deps.some((d, i) => [...d].some((o) => o > i))) return script;

  const order: number[] = [];
  const placed = new Set<number>();
  while (order.length < stmts.length) {
    let pick = -1;
    for (let i = 0; i < stmts.length; i++) {
      if (placed.has(i)) continue;
      if ([...deps[i]!].every((o) => placed.has(o))) {
        pick = i;
        break;
      }
    }
    if (pick === -1) {
      // A cycle: keep source order for what is left.
      pick = stmts.findIndex((_, i) => !placed.has(i));
    }
    placed.add(pick);
    order.push(pick);
  }

  // Each chunk is a statement with the whitespace and comments before it.
  const offset = PREFIX.length;
  const chunks: string[] = [];
  let cursor = 0;
  for (const s of stmts) {
    const end = s.node.end! - offset;
    chunks.push(script.slice(cursor, end));
    cursor = end;
  }
  const tail = script.slice(cursor);
  const out = order
    .map((i, pos) => {
      const chunk = chunks[i]!;
      // The first chunk starts at the statement; the others carry a separator.
      if (pos === 0) return chunk.replace(/^\s+/, '');
      return i === 0 ? `\n${chunk}` : chunk;
    })
    .join('');
  return out + tail;
}

/** A function that runs where it is created: a hook initialiser or an IIFE. */
function runsImmediately(p: NodePath<t.Function>): boolean {
  const parent = p.parentPath;
  if (!parent?.isCallExpression()) return false;
  if (parent.node.callee === p.node) return true;
  const callee = parent.node.callee;
  return (
    parent.node.arguments[0] === p.node &&
    t.isIdentifier(callee) &&
    EAGER_CALLBACK_HOOKS.has(callee.name)
  );
}

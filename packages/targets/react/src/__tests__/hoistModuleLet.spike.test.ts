/**
 * Wave 0 spike — Pitfall 3 / Pitfall 8 / Assumption A8 resolution.
 *
 * Plan 04-02 Task 0: determine whether Modal.rozie's
 *   `let savedBodyOverflow = ''`
 * referenced via `lockScroll` (passed to `$onMount(lockScroll)`) is auto-
 * hoistable to `useRef('')` or whether we must emit ROZ523 hard error and
 * require the user to refactor.
 *
 * Categorization rules (per plan):
 *   (a) DIRECT — let X referenced inside the setup arrow itself
 *   (b) ONE-LEVEL HELPER — let X referenced inside a top-level helper-fn
 *       passed directly to $onMount as an Identifier, OR called from a
 *       setup arrow's body
 *   (c) DEEPLY NESTED — >= 2 levels of function indirection, OR helper is
 *       reassigned, OR module-let is written from outside any lifecycle path
 *
 * Outcome:
 *   - (a) or (b) → SHIP AUTO-HOIST + emit ROZ522
 *   - (c) → SHIP ROZ523 hard error
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

describe('hoistModuleLet — Wave 0 spike on Modal.rozie', () => {
  it('Modal.rozie module-let `savedBodyOverflow` reference category is (b) ONE-LEVEL HELPER', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'examples/Modal.rozie'), 'utf8');
    const parsed = parse(src, { filename: 'Modal.rozie' });
    expect(parsed.ast).not.toBeNull();
    const lowered = lowerToIR(parsed.ast!, { modifierRegistry: createDefaultRegistry() });
    expect(lowered.ir).not.toBeNull();
    const ir = lowered.ir!;
    const program = ir.setupBody.scriptProgram;

    // 1. Find the top-level `let savedBodyOverflow = ''` declaration.
    const moduleLets: Array<{ name: string; init: t.Expression | null | undefined; index: number }> = [];
    program.program.body.forEach((stmt, idx) => {
      if (t.isVariableDeclaration(stmt) && stmt.kind === 'let') {
        for (const d of stmt.declarations) {
          if (t.isIdentifier(d.id)) {
            moduleLets.push({ name: d.id.name, init: d.init, index: idx });
          }
        }
      }
    });
    const savedBodyOverflowDecl = moduleLets.find((m) => m.name === 'savedBodyOverflow');
    expect(savedBodyOverflowDecl).toBeDefined();

    // 2. Find top-level helper functions/arrows that reference `savedBodyOverflow`.
    //    Helpers are top-level `const X = () => ...` or `function X() { ... }`.
    const topLevelHelperNames = new Set<string>();
    const helperReferences = new Map<string, Set<string>>(); // helperName → Set of module-let names referenced

    program.program.body.forEach((stmt) => {
      // const X = () => {...}; or const X = function() {...};
      if (t.isVariableDeclaration(stmt)) {
        for (const d of stmt.declarations) {
          if (
            t.isIdentifier(d.id) &&
            d.init &&
            (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
          ) {
            topLevelHelperNames.add(d.id.name);
            const refs = new Set<string>();
            traverse(t.file(t.program([t.expressionStatement(d.init)])), {
              Identifier(path) {
                if (
                  path.node.name === 'savedBodyOverflow' &&
                  // Skip property positions
                  !(t.isMemberExpression(path.parent) &&
                    path.parent.property === path.node &&
                    !path.parent.computed)
                ) {
                  refs.add(path.node.name);
                }
              },
            });
            if (refs.size > 0) helperReferences.set(d.id.name, refs);
          }
        }
      }
      // function X() {...}
      if (t.isFunctionDeclaration(stmt) && stmt.id) {
        topLevelHelperNames.add(stmt.id.name);
        const refs = new Set<string>();
        traverse(t.file(t.program([stmt])), {
          Identifier(path) {
            if (
              path.node.name === 'savedBodyOverflow' &&
              !(t.isMemberExpression(path.parent) &&
                path.parent.property === path.node &&
                !path.parent.computed)
            ) {
              refs.add(path.node.name);
            }
          },
        });
        if (refs.size > 0) helperReferences.set(stmt.id.name, refs);
      }
    });

    // 3. Lifecycle setup bodies: scan ir.lifecycle for refs.
    //    Modal: $onMount(lockScroll) → setup is Identifier{name:'lockScroll'}
    //          $onUnmount(unlockScroll) is paired into LifecycleHook.cleanup.
    let directRef = false;
    let helperRef = false;
    let helperRefName: string | null = null;

    for (const lh of ir.lifecycle) {
      const setup = lh.setup;
      // Case (a): setup is an arrow/function whose body directly references the let.
      if (t.isArrowFunctionExpression(setup) || t.isFunctionExpression(setup)) {
        traverse(t.file(t.program([t.expressionStatement(setup)])), {
          Identifier(path) {
            if (
              path.node.name === 'savedBodyOverflow' &&
              !(t.isMemberExpression(path.parent) &&
                path.parent.property === path.node &&
                !path.parent.computed)
            ) {
              directRef = true;
            }
          },
        });
      }
      // Case (b): setup is an Identifier referring to a top-level helper that
      // references the let.
      if (t.isIdentifier(setup) && topLevelHelperNames.has(setup.name)) {
        const refs = helperReferences.get(setup.name);
        if (refs && refs.has('savedBodyOverflow')) {
          helperRef = true;
          helperRefName = setup.name;
        }
      }
      // Cleanup may also be an Identifier or expression — apply the same logic.
      if (lh.cleanup) {
        if (t.isIdentifier(lh.cleanup) && topLevelHelperNames.has(lh.cleanup.name)) {
          const refs = helperReferences.get(lh.cleanup.name);
          if (refs && refs.has('savedBodyOverflow')) {
            helperRef = true;
            helperRefName = helperRefName ?? lh.cleanup.name;
          }
        }
      }
    }

    // Modal.rozie's expected category: (b) — `savedBodyOverflow` is referenced
    // by `lockScroll` (and `unlockScroll`), which are passed directly to
    // $onMount/$onUnmount as Identifiers.
    expect(directRef).toBe(false);
    expect(helperRef).toBe(true);
    expect(helperRefName).toBe('lockScroll');

    // Spike OUTCOME: category (b) → AUTO-HOIST is feasible.
  });
});

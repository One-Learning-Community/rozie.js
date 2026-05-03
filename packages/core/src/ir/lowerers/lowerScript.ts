/**
 * lowerScript — produce ComputedDecl[] + LifecycleHook[] + SetupBody + emits[].
 *
 * Plan 02-05 Task 2. The highest-leverage lowerer in this plan because it
 * implements:
 *   - D-19 LifecycleHook pairing (cleanup-return extraction + adjacent
 *     $onMount/$onUnmount merging)
 *   - IR-04 referential preservation (setupBody.scriptProgram === ast.script.program)
 *   - Risk 5 trust-erosion floor (console.log survives untouched)
 *   - ROZ105 emission for `$onMount(async () => …)` (Pitfall 2)
 *
 * Per D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { ScriptAST } from '../../ast/blocks/ScriptAST.js';
import type {
  BindingsTable,
  LifecycleHookEntry,
} from '../../semantic/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { ReactiveDepGraph } from '../../reactivity/ReactiveDepGraph.js';
import { extractCleanupReturn } from '../../semantic/visitors.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type {
  ComputedDecl,
  LifecycleHook,
  SetupBody,
  SetupAnnotation,
} from '../types.js';

export interface LowerScriptResult {
  computed: ComputedDecl[];
  lifecycle: LifecycleHook[];
  setupBody: SetupBody;
  emits: string[];
}

/**
 * D-19 pairing — given a list of LifecycleHookEntry items in source order,
 * produce LifecycleHook IR nodes with cleanup-return extraction AND
 * adjacent-mount/unmount merging.
 *
 * T-2-05-05 conservative pairing rule for adjacent merge:
 *   (a) prior entry is `phase: 'mount'`
 *   (b) prior entry's setup is an Identifier (not an arrow body)
 *   (c) prior entry has no inline cleanup-return
 *   (d) current entry is `phase: 'unmount'`
 *
 * When all four conditions met, merge: take the unmount callback as the prior
 * mount's cleanup, skip emitting a separate unmount hook.
 */
function pairLifecycleHooks(
  entries: LifecycleHookEntry[],
  diagnostics: Diagnostic[],
  depGraph: ReactiveDepGraph,
): LifecycleHook[] {
  const out: LifecycleHook[] = [];

  // Track which input indices have been consumed (to skip merged unmount entries).
  const consumed = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (consumed.has(i)) continue;
    const entry = entries[i]!;
    const setupDeps = [...depGraph.forNodeOrEmpty(`lifecycle.${i}.setup`)];

    if (entry.phase === 'mount' || entry.phase === 'update') {
      const callback = entry.callback;
      let setup: t.BlockStatement | t.Expression;
      let cleanup: t.Expression | undefined;

      // Cleanup-return extraction requires an arrow/function literal callback.
      if (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback)) {
        const extraction = extractCleanupReturn(callback);
        setup = extraction.setup;
        cleanup = extraction.cleanup ?? undefined;

        // Async + cleanup attempt → ROZ105 warning, drop cleanup.
        if (extraction.isAsync && extraction.warnings.length > 0) {
          // Check whether the user actually returned something the warning flagged.
          // extractCleanupReturn returns isAsync: true for async arrows; the
          // warnings list is empty in that case (cleanup already null) but the
          // ASYNC_ONMOUNT_RETURN diagnostic should still fire if a return exists.
          // We approximate by inspecting the body for a ReturnStatement.
          const hasReturn =
            t.isBlockStatement(callback.body) &&
            callback.body.body.some((s) => t.isReturnStatement(s));
          if (hasReturn) {
            diagnostics.push({
              code: RozieErrorCode.ASYNC_ONMOUNT_RETURN,
              severity: 'warning',
              message:
                'async $onMount cannot return a cleanup function — the Promise return is implicit',
              loc: entry.sourceLoc,
              hint: 'Move the teardown into a separate $onUnmount call, or remove the async modifier.',
            });
          }
          cleanup = undefined;
        }

        // Conditional / non-function cleanup warnings (non-async cases).
        // Each warning kind gets its own code so consumers can distinguish them
        // from the async-return case (ROZ105) — WR-02 fix.
        for (const w of extraction.warnings) {
          if (extraction.isAsync) continue; // already handled above as ROZ105
          // Dispatch on message prefix to assign the correct code.
          const code = w.message.startsWith('conditional cleanup return')
            ? RozieErrorCode.CONDITIONAL_CLEANUP_RETURN  // ROZ107
            : RozieErrorCode.NON_FUNCTION_CLEANUP_RETURN; // ROZ108 (non-function return)
          diagnostics.push({
            code,
            severity: 'warning',
            message: w.message,
            loc: entry.sourceLoc,
          });
        }
      } else {
        // Identifier-style $onMount(lockScroll) — setup IS the Identifier.
        setup = callback;
      }

      // Adjacent merge with following $onUnmount (T-2-05-05).
      let mergedSetupDeps = setupDeps;
      if (
        entry.phase === 'mount' &&
        cleanup === undefined &&
        t.isIdentifier(setup) &&
        i + 1 < entries.length
      ) {
        const next = entries[i + 1]!;
        if (next.phase === 'unmount') {
          cleanup = next.callback;
          consumed.add(i + 1);
          // Plan 04-04 Rule 2 — merge cleanup deps so React useEffect dep array
          // is exhaustive-deps lint-clean. Without this, `useEffect(() => {
          // setup; return cleanup; }, [setup])` triggers
          // "missing dependency: cleanup".
          const cleanupDeps = [
            ...depGraph.forNodeOrEmpty(`lifecycle.${i + 1}.setup`),
          ];
          const seen = new Set(setupDeps.map((d) => JSON.stringify(d)));
          mergedSetupDeps = [...setupDeps];
          for (const d of cleanupDeps) {
            const key = JSON.stringify(d);
            if (seen.has(key)) continue;
            seen.add(key);
            mergedSetupDeps.push(d);
          }
        }
      }

      out.push({
        type: 'LifecycleHook',
        phase: entry.phase,
        setup,
        ...(cleanup !== undefined ? { cleanup } : {}),
        setupDeps: mergedSetupDeps,
        sourceLoc: entry.sourceLoc,
      });
    } else {
      // Standalone unmount (no preceding mount it can pair with, or pairing
      // failed) — emit as its own hook.
      out.push({
        type: 'LifecycleHook',
        phase: 'unmount',
        setup: entry.callback,
        setupDeps,
        sourceLoc: entry.sourceLoc,
      });
    }
  }

  return out;
}

/**
 * Walk the Babel Program top-level body and tag each statement with a
 * SetupAnnotation describing its semantic role.
 */
function buildAnnotations(script: ScriptAST, bindings: BindingsTable): SetupAnnotation[] {
  const annotations: SetupAnnotation[] = [];
  const programBody = script.program.program.body;
  programBody.forEach((stmt, idx) => {
    const nodeId = `script.program.body[${idx}]`;
    if (t.isVariableDeclaration(stmt)) {
      // Scan declarators for $computed
      let isComputed = false;
      for (const d of stmt.declarations) {
        if (
          d.init &&
          t.isCallExpression(d.init) &&
          t.isIdentifier(d.init.callee) &&
          d.init.callee.name === '$computed'
        ) {
          isComputed = true;
          break;
        }
      }
      annotations.push({
        nodeId,
        kind: isComputed ? 'computed' : 'plain-decl',
      });
      return;
    }
    if (t.isExpressionStatement(stmt)) {
      const expr = stmt.expression;
      if (
        t.isCallExpression(expr) &&
        t.isIdentifier(expr.callee) &&
        (expr.callee.name === '$onMount' ||
          expr.callee.name === '$onUnmount' ||
          expr.callee.name === '$onUpdate')
      ) {
        annotations.push({ nodeId, kind: 'lifecycle' });
        return;
      }
    }
    if (t.isFunctionDeclaration(stmt)) {
      annotations.push({ nodeId, kind: 'helper-fn' });
      return;
    }
    annotations.push({ nodeId, kind: 'plain-decl' });
  });
  // Silence "unused" for bindings parameter — we may use it for future
  // helper-fn detection refinements (e.g., distinguishing helpers from
  // other plain-decls). Currently kept simple.
  void bindings;
  return annotations;
}

export function lowerScript(
  script: ScriptAST,
  bindings: BindingsTable,
  depGraph: ReactiveDepGraph,
  diagnostics: Diagnostic[],
): LowerScriptResult {
  // 1. ComputedDecl[]
  const computed: ComputedDecl[] = [];
  for (const [name, entry] of bindings.computeds) {
    const deps = [...depGraph.forNodeOrEmpty(`computed.${name}`)];
    computed.push({
      type: 'ComputedDecl',
      name,
      body: entry.callback.body,
      deps,
      sourceLoc: entry.sourceLoc,
    });
  }

  // 2. LifecycleHook[] with D-19 pairing
  const lifecycle = pairLifecycleHooks(bindings.lifecycle, diagnostics, depGraph);

  // 3. SetupBody — IR-04 referential preservation
  const setupBody: SetupBody = {
    type: 'SetupBody',
    scriptProgram: script.program, // SAME reference; no clone.
    annotations: buildAnnotations(script, bindings),
  };

  // 4. emits — collected by Plan 02-01; nothing to add here (template-level
  // discovery handled by lowerTemplate via $emit() walk).
  const emits = [...bindings.emits];

  return { computed, lifecycle, setupBody, emits };
}

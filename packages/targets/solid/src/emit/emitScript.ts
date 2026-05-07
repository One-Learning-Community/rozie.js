/**
 * emitScript — Solid target (P1 minimal implementation).
 *
 * Produces the body of the Solid functional component above the `return ( <JSX> );`.
 * P1 maps the IR's state/computed/lifecycle primitives to Solid equivalents.
 * P2 will add full $data/$props/$refs/$emit rewriting via @babel/traverse.
 *
 * Result shape mirrors React's EmitScriptResult but drops `lifecycleEffectsSection`
 * and `hasPropsDefaults` (Solid always uses splitProps; lifecycle goes inline).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: false,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export interface EmitScriptResult {
  /**
   * Solid signal/memo/lifecycle declarations + user-authored helpers.
   */
  hookSection: string;
  /** Alias for hookSection (kept for structural parity with React's EmitScriptResult). */
  userArrowsSection: string;
  /**
   * Phase 06.1 P2: per-expression child sourcemap. null in P1.
   */
  scriptMap: EncodedSourceMap | null;
  diagnostics: Diagnostic[];
}

export interface EmitScriptCollectors {
  solidImports: SolidImportCollector;
  runtimeImports: RuntimeSolidImportCollector;
}

export function emitScript(
  ir: IRComponent,
  collectors: EmitScriptCollectors,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _registry?: unknown,
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const hookLines: string[] = [];

  // Clone + rewrite the Babel program (P1: minimal rewrite).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // 1. createControllableSignal for model:true props (D-135).
  for (const p of ir.props) {
    if (!p.isModel) continue;
    collectors.runtimeImports.add('createControllableSignal');
    const setterName = 'set' + capitalize(p.name);
    let dflt = 'undefined';
    if (p.defaultValue !== null) {
      dflt = genCode(p.defaultValue);
    }
    hookLines.push(
      `const [${p.name}, ${setterName}] = createControllableSignal(_props, '${p.name}', ${dflt});`,
    );
  }

  // 2. createSignal for each StateDecl (<data> entries).
  for (const s of ir.state) {
    collectors.solidImports.add('createSignal');
    const setterName = 'set' + capitalize(s.name);
    hookLines.push(
      `const [${s.name}, ${setterName}] = createSignal(${genCode(s.initializer)});`,
    );
  }

  // 3. createMemo for each ComputedDecl.
  for (const c of ir.computed) {
    collectors.solidImports.add('createMemo');
    const bodyCode = genCode(c.body);
    hookLines.push(`const ${c.name} = createMemo(() => ${bodyCode});`);
  }

  // 4. onMount/onCleanup for each LifecycleHook.
  for (const lh of ir.lifecycle) {
    if (lh.phase === 'mount') {
      if (lh.cleanup) {
        // Paired mount+cleanup: wrap in onMount, call onCleanup inside.
        // Shape: onMount(() => { const _cleanup = setupFn(); if (_cleanup) onCleanup(_cleanup); })
        collectors.solidImports.add('onMount');
        collectors.solidImports.add('onCleanup');
        const setupCode = genCode(lh.setup);
        const cleanupCode = genCode(lh.cleanup);
        hookLines.push(
          `onMount(() => {\n` +
          `  const _cleanup = (${setupCode})();\n` +
          `  if (_cleanup) onCleanup(_cleanup);\n` +
          `  onCleanup(${cleanupCode});\n` +
          `});`,
        );
      } else {
        collectors.solidImports.add('onMount');
        const setupCode = genCode(lh.setup);
        hookLines.push(`onMount(${setupCode});`);
      }
    } else if (lh.phase === 'unmount') {
      collectors.solidImports.add('onCleanup');
      const setupCode = genCode(lh.setup);
      hookLines.push(`onCleanup(${setupCode});`);
    } else if (lh.phase === 'update') {
      // update phase: createEffect re-runs on tracked dependency change
      collectors.solidImports.add('createEffect');
      const setupCode = genCode(lh.setup);
      hookLines.push(`createEffect(${setupCode});`);
    }
  }

  // 4b. Ref variable declarations: `let fooRef: Element | null = null;`
  // Solid uses plain let variables (not useRef objects) for DOM refs.
  for (const ref of ir.refs) {
    hookLines.push(`let ${ref.name}Ref: Element | null = null;`);
  }

  // 5. Emit user-authored top-level statements from the rewritten program.
  //    Skip: $computed declarators (handled above), $onMount/$onUnmount calls.
  const userLines: string[] = [];
  for (const stmt of rewriteResult.rewrittenProgram.program.body) {
    // Skip $computed variable declarations.
    if (t.isVariableDeclaration(stmt)) {
      const allComputed = stmt.declarations.every(
        (d) =>
          d.init &&
          t.isCallExpression(d.init) &&
          t.isIdentifier(d.init.callee) &&
          d.init.callee.name === '$computed',
      );
      if (allComputed) continue;
    }
    // Skip lifecycle call expressions.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (
        t.isIdentifier(callee) &&
        (callee.name === '$onMount' || callee.name === '$onUnmount' || callee.name === '$onUpdate')
      ) {
        continue;
      }
    }
    userLines.push(genCode(stmt));
  }

  const hookSection = hookLines.join('\n');
  const userArrowsSection = userLines.join('\n');

  return {
    hookSection,
    userArrowsSection,
    scriptMap: null,
    diagnostics,
  };
}

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
import { rewriteRozieIdentifiers, rewriteRozieExpressionNode as rewriteNode } from '../rewrite/rewriteScript.js';

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
      const raw = genCode(p.defaultValue);
      // When the prop default is a factory arrow/function (e.g. `default: () => []`),
      // the emitted `createControllableSignal` third arg should be the *initial value*
      // (the result of calling the factory), not the factory itself — otherwise
      // TypeScript infers T as the function type rather than the array/object type.
      if (
        t.isArrowFunctionExpression(p.defaultValue) ||
        t.isFunctionExpression(p.defaultValue)
      ) {
        dflt = `(${raw})()`;
      } else {
        dflt = raw;
      }
    }
    hookLines.push(
      `const [${p.name}, ${setterName}] = createControllableSignal(_props as Record<string, unknown>, '${p.name}', ${dflt});`,
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
  // Rule 1 fix: rewrite $props/$data/$refs in the computed body before emitting.
  for (const c of ir.computed) {
    collectors.solidImports.add('createMemo');
    const rewrittenBody = rewriteNode(c.body, ir);
    const bodyCode = genCode(rewrittenBody);
    hookLines.push(`const ${c.name} = createMemo(() => ${bodyCode});`);
  }

  // 4. onMount/onCleanup for each LifecycleHook.
  //
  // Rule 1 fix: when lh.setup is a BlockStatement, genCode() produces `{ ... }`
  // which Babel's generator renders as an object literal — invalid as a function
  // argument. Wrap BlockStatements in an arrow function; Expressions are passed
  // directly (they're already function values from user-authored code).
  function lifecycleArg(node: t.Node): string {
    if (t.isBlockStatement(node)) {
      // Wrap block in arrow: () => { stmts }
      const code = genCode(node);
      return `() => ${code}`;
    }
    return genCode(node);
  }

  for (const lh of ir.lifecycle) {
    if (lh.phase === 'mount') {
      if (lh.cleanup) {
        // Paired mount+cleanup: wrap in onMount, call onCleanup inside.
        // Shape: onMount(() => { const _cleanup = setupFn(); if (_cleanup) onCleanup(_cleanup); })
        collectors.solidImports.add('onMount');
        collectors.solidImports.add('onCleanup');
        // Rule 1 fix: rewrite $props/$data/$refs in the setup body; wrap BlockStatement in IIFE.
        const rewrittenSetup = rewriteNode(lh.setup, ir);
        const rawSetup = genCode(rewrittenSetup);
        const setupCall = t.isBlockStatement(lh.setup)
          ? `(() => ${rawSetup})()`
          : `(${rawSetup})()`;
        const rewrittenCleanup = rewriteNode(lh.cleanup, ir);
        const cleanupCode = genCode(rewrittenCleanup);
        hookLines.push(
          `onMount(() => {\n` +
          `  const _cleanup = ${setupCall} as unknown;\n` +
          `  if (_cleanup) onCleanup(_cleanup as () => void);\n` +
          `  onCleanup(${cleanupCode});\n` +
          `});`,
        );
      } else {
        collectors.solidImports.add('onMount');
        const rewrittenSetup = rewriteNode(lh.setup, ir);
        const arg = lifecycleArg(rewrittenSetup);
        hookLines.push(`onMount(${arg});`);
      }
    } else if (lh.phase === 'unmount') {
      collectors.solidImports.add('onCleanup');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`onCleanup(${arg});`);
    } else if (lh.phase === 'update') {
      // update phase: createEffect re-runs on tracked dependency change
      collectors.solidImports.add('createEffect');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`createEffect(${arg});`);
    }
  }

  // 4b. Ref variable declarations: `let fooRef: HTMLElement | null = null;`
  // Solid uses plain let variables (not useRef objects) for DOM refs.
  // Using HTMLElement (not Element) so DOM properties like .style, .focus() are accessible.
  for (const ref of ir.refs) {
    hookLines.push(`let ${ref.name}Ref: HTMLElement | null = null;`);
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

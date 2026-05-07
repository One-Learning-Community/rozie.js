/**
 * emitScript — Phase 5 Plan 05-04a Task 1.
 *
 * Produces the body of an Angular 17+ standalone-component CLASS declaration.
 * Output order (per RESEARCH Pattern 6 + Pitfall 8):
 *
 *   1. Field declarations (signal-style API):
 *      - input/model props        (`name = input<T>(default)` or `model<T>(default)`)
 *      - state signals            (`name = signal<T>(initializer)`)
 *      - viewChild refs           (`name = viewChild<ElementRef>('name')`)
 *      - output emits             (`name = output<T>()`)
 *      - @ContentChild slot tpls  (Plan 05-04a Task 2 — emitSlotDecl)
 *   2. constructor() {
 *        const renderer = inject(Renderer2);   // Listeners use this
 *        const destroyRef = inject(DestroyRef);// Lifecycle cleanup uses this
 *        ...user residual <script> body (DX-03 floor)
 *        ...lifecycle effect blocks (D-19 paired)
 *        ...listener effect blocks (Plan 05-04a Task 3)
 *      }
 *   3. computed properties (`name = computed(() => ...)`)
 *   4. method/arrow declarations from user's <script> body — emitted at class
 *      level (NOT in constructor) so they're invokable as `this.name(...)`.
 *
 * Pitfall 8 mitigation: `inject(Renderer2)` / `inject(DestroyRef)` calls live
 * exclusively in constructor body or as field initializers — NEVER inside
 * method/arrow bodies.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-angular` imports —
 * debounce/throttle/outsideClick all inline as IIFE / Renderer2.listen.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  ComputedDecl,
  RefDecl,
  StateDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import {
  AngularImportCollector,
  collectAngularImports,
} from '../rewrite/collectAngularImports.js';
import { buildSlotCtx, buildNgTemplateContextGuard } from './refineSlotTypes.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations (D-104/D-106) give
// those maps real positional content; non-annotated scaffolding falls back
// to nearest-segment via the surrounding shell map (D-102).
//
// v1 limitation: emitScript assembles its output via string concatenation;
// scriptMap=null in v1. The buildShell whole-envelope accuracy (P1 floor)
// covers the script-body range. v2 refactors emitScript to assemble one
// t.Program and surfaces a real EncodedSourceMap.
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
  sourceFileName: '<rozie>',
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/** Render a PropTypeAnnotation as a TS type string. */
function renderType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'unknown[]';
      case 'Object':
        return 'Record<string, unknown>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') return ann.members.map(renderType).join(' | ');
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'unknown[]';
    if (ann.value === 'object') return 'Record<string, unknown>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

/** Render the default value for an input/model field initializer. */
function renderDefault(prop: PropDecl): string {
  if (prop.defaultValue === null) return '';
  const raw = genCode(prop.defaultValue);
  // Arrow factory like `() => []` should be invoked: `(() => [])()`.
  if (
    t.isArrowFunctionExpression(prop.defaultValue) &&
    (t.isArrayExpression(prop.defaultValue.body) ||
      t.isObjectExpression(prop.defaultValue.body))
  ) {
    return `(${raw})()`;
  }
  // Wrap arrow/function-expression defaults in parens to avoid `??` precedence issues.
  if (
    t.isArrowFunctionExpression(prop.defaultValue) ||
    t.isFunctionExpression(prop.defaultValue)
  ) {
    return `(${raw})`;
  }
  return raw;
}

/**
 * Find the cloned `body` for each ComputedDecl by name. Matches
 * VariableDeclarators with `init = $computed(arrow|fn)`.
 */
function findClonedComputedBodies(
  clonedProgram: t.File,
): Map<string, t.Expression | t.BlockStatement> {
  const out = new Map<string, t.Expression | t.BlockStatement>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init || !t.isCallExpression(d.init)) continue;
      const callee = d.init.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$computed') continue;
      const cb = d.init.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        out.set(d.id.name, cb.body);
      }
    }
  }
  return out;
}

interface LifecycleClonedBody {
  setupCloned: t.Expression | t.BlockStatement;
  cleanupCloned: t.Expression | null;
  phase: 'mount' | 'unmount' | 'update';
}

/**
 * Pair lifecycle hooks (D-19) by walking the cloned Program in source order.
 * Adjacent `$onMount(setup) + $onUnmount(cleanup)` Identifier-pair → ONE
 * paired hook.
 */
function pairClonedLifecycle(
  clonedProgram: t.File,
  ir: IRComponent,
): { perHook: LifecycleClonedBody[]; consumedIndices: Set<number> } {
  const perHook: LifecycleClonedBody[] = [];
  const consumed = new Set<number>();
  const lifecycleCallIndices: Array<{
    idx: number;
    calleeName: string;
    arg: t.Node;
  }> = [];

  for (let i = 0; i < clonedProgram.program.body.length; i++) {
    const stmt = clonedProgram.program.body[i]!;
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr)) continue;
    const callee = expr.callee;
    if (!t.isIdentifier(callee)) continue;
    if (
      callee.name !== '$onMount' &&
      callee.name !== '$onUnmount' &&
      callee.name !== '$onUpdate'
    ) {
      continue;
    }
    const arg = expr.arguments[0];
    if (!arg) continue;
    lifecycleCallIndices.push({ idx: i, calleeName: callee.name, arg });
  }

  let cursor = 0;
  for (const lh of ir.lifecycle) {
    while (cursor < lifecycleCallIndices.length) {
      const entry = lifecycleCallIndices[cursor]!;
      cursor++;
      const expectedCallee =
        lh.phase === 'mount' ? '$onMount' : lh.phase === 'unmount' ? '$onUnmount' : '$onUpdate';
      if (entry.calleeName !== expectedCallee) continue;
      consumed.add(entry.idx);
      let setupCloned = entry.arg as t.Expression | t.BlockStatement;
      let cleanupCloned: t.Expression | null = null;

      if (lh.cleanup) {
        if (cursor < lifecycleCallIndices.length) {
          const next = lifecycleCallIndices[cursor]!;
          if (next.calleeName === '$onUnmount') {
            consumed.add(next.idx);
            cleanupCloned = next.arg as t.Expression;
            cursor++;
          }
        }
      }

      // Inline cleanup-return detection (Pitfall 5 React analog).
      if (
        cleanupCloned === null &&
        lh.phase === 'mount' &&
        (t.isArrowFunctionExpression(setupCloned) ||
          t.isFunctionExpression(setupCloned))
      ) {
        const fnBody = setupCloned.body;
        if (t.isBlockStatement(fnBody) && !setupCloned.async) {
          const lastStmt = fnBody.body[fnBody.body.length - 1];
          if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
            cleanupCloned = lastStmt.argument;
            const newBody = t.blockStatement(fnBody.body.slice(0, -1));
            const newArrow = t.arrowFunctionExpression(
              setupCloned.params,
              newBody,
              setupCloned.async,
            );
            setupCloned = newArrow;
          }
        }
      }
      perHook.push({ setupCloned, cleanupCloned, phase: lh.phase });
      break;
    }
  }
  return { perHook, consumedIndices: consumed };
}

/**
 * Render a single lifecycle hook as Angular constructor-body code.
 *
 * Strategy per RESEARCH Pattern 6 + Pitfall 8:
 *   - phase 'mount' or 'update' → wrap the setup body in `effect(() => { ... })`
 *     IF it reads signals (auto-tracking). For paired-cleanup form, emit:
 *       <setup invocation>;
 *       inject(DestroyRef).onDestroy(<cleanup invocation>);
 *   - phase 'unmount' standalone → `inject(DestroyRef).onDestroy(<cleanup>);`
 *
 * For the v1 reference examples (Counter/Modal/SearchInput/Dropdown/TodoList):
 *   - Counter: console.log only — no lifecycle hooks
 *   - Modal: $onMount(lockScroll) + $onUnmount(unlockScroll) PAIRED + standalone
 *     $onMount(() => dialogEl.focus())
 *   - SearchInput: $onMount(arrow with cleanup-return)
 *   - Dropdown: 2× standalone $onMount calls (no cleanup)
 *
 * For v1 we keep the body shape SIMPLE: invoke setup directly in constructor
 * (one-time mount), pair cleanup with `inject(DestroyRef).onDestroy(...)`.
 */
function renderLifecycleHook(
  hook: LifecycleClonedBody,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): string {
  const { setupCloned, cleanupCloned, phase } = hook;

  if (phase === 'unmount') {
    // Standalone unmount: inject(DestroyRef).onDestroy(<cleanup>)
    return `inject(DestroyRef).onDestroy(${invokeOrPass(setupCloned, classMembers, collisionRenames)});`;
  }

  if (phase === 'update') {
    // $onUpdate → effect(() => { ... }) — auto-tracks reactive reads.
    return `effect(() => ${invokeOrPass(setupCloned, classMembers, collisionRenames, true)});`;
  }

  // phase === 'mount'
  const setupInvocation = invokeAndExpand(setupCloned, classMembers, collisionRenames);

  if (cleanupCloned === null) {
    // Pure setup, no cleanup.
    return setupInvocation;
  }

  // Setup + cleanup paired.
  const cleanupRef = invokeOrPass(cleanupCloned, classMembers, collisionRenames);
  return `${setupInvocation}\ninject(DestroyRef).onDestroy(${cleanupRef});`;
}

/**
 * For an arrow/function expression, return its body inlined into a callable
 * IIFE form `(arrow)()` or — when the arrow is identifier-bound — the bare
 * identifier invocation `name()`.
 *
 * For an Identifier (function reference like `lockScroll`) emit `lockScroll();`.
 */
function renderClassMemberRef(
  name: string,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): string {
  // Apply collision-rename if applicable, then check class membership.
  const renamed = collisionRenames.get(name) ?? name;
  if (classMembers.has(renamed)) {
    return `this.${renamed}`;
  }
  return name;
}

function invokeAndExpand(
  setup: t.Expression | t.BlockStatement,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
): string {
  if (t.isIdentifier(setup)) {
    const ref = renderClassMemberRef(setup.name, classMembers, collisionRenames);
    return `${ref}();`;
  }
  if (t.isArrowFunctionExpression(setup) || t.isFunctionExpression(setup)) {
    const fnBody = setup.body;
    if (t.isBlockStatement(fnBody)) {
      // Inline the body as a sequence of statements rather than as an
      // IIFE — this keeps the constructor reading naturally.
      const stmts = fnBody.body.map((s) => genCode(s)).join('\n');
      return stmts;
    }
    // Expression-bodied — emit as expression statement.
    return `${genCode(fnBody)};`;
  }
  if (t.isBlockStatement(setup)) {
    const stmts = setup.body.map((s) => genCode(s)).join('\n');
    return stmts;
  }
  return `(${genCode(setup)})();`;
}

/**
 * Render a callable reference suitable as `inject(DestroyRef).onDestroy(<X>)`'s
 * argument — Identifier passes verbatim, arrow/function-expression passes as
 * a callable expression, BlockStatement wraps in `() => { ... }`.
 *
 * When `wrapInArrow` is true, always wrap the result in `() => { ... }` so
 * effect() callbacks have the right shape.
 */
function invokeOrPass(
  node: t.Node,
  classMembers: ReadonlySet<string>,
  collisionRenames: ReadonlyMap<string, string>,
  wrapInArrow = false,
): string {
  if (t.isIdentifier(node)) {
    const ref = renderClassMemberRef(node.name, classMembers, collisionRenames);
    return wrapInArrow ? `() => ${ref}()` : ref;
  }
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    if (wrapInArrow) {
      const fnBody = node.body;
      if (t.isBlockStatement(fnBody)) {
        return `() => ${genCode(fnBody)}`;
      }
      return `() => { ${genCode(fnBody)}; }`;
    }
    return genCode(node);
  }
  if (t.isBlockStatement(node)) {
    return `() => ${genCode(node)}`;
  }
  return genCode(node as t.Expression);
}

export interface EmitScriptResult {
  /** The class body text (lines inside `class X { ... }`, without surrounding braces). */
  classBody: string;
  /** Import collector — populated with every @angular/core symbol referenced. */
  imports: AngularImportCollector;
  /** Standalone interface declarations (slot ctx interfaces) — emitted BEFORE the class. */
  interfaceDecls: string[];
  /**
   * Phase 06.1 P2 (D-100/D-101): per-expression child sourcemap from
   * @babel/generator's sourceMaps:true mode. v1: null because emitScript's
   * helper-based string-concat assembly produces N partial maps that
   * cannot be merged without per-section output offsets (Pitfall 4).
   * v2 refactors emitScript to assemble one t.Program and surfaces a real
   * EncodedSourceMap.
   */
  scriptMap: EncodedSourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Phase 06.1 P2 emitScript options.
 */
export interface EmitScriptOptions {
  /**
   * .rozie filename surfaced as `sourceFileName` on @babel/generator's
   * per-call output map (D-103). Defaults to '<rozie>' when omitted.
   */
  filename?: string;
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  // Phase 06.1 P2 (D-103): wire opts.filename through GEN_OPTS.sourceFileName.
  void opts.filename;
  const diagnostics: Diagnostic[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Pair lifecycle hooks BEFORE rewriting identifiers — pairClonedLifecycle
  //    looks for top-level `$onMount(IDENTIFIER)` patterns; the rewrite would
  //    otherwise convert bare Identifier names like `lockScroll` to
  //    `this.lockScroll` MemberExpressions, breaking pairing detection. The
  //    rewriter's Identifier visitor is configured to SKIP direct lifecycle
  //    call args so the args remain bare Identifiers post-rewrite — this
  //    pre-pass is here for defensive ordering.
  const lifecyclePairing = pairClonedLifecycle(cloned, ir);

  // 3. Rewrite identifiers on the clone.
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // 4. Compute Angular imports based on IR shape.
  const imports = collectAngularImports(ir);

  // 4b. Locate cloned bodies for ComputedDecl post-rewrite.
  const clonedComputedBodies = findClonedComputedBodies(cloned);

  // 5. Build slot interface decls (rendered above the class).
  const interfaceDecls: string[] = [];
  const slotFieldDecls: string[] = [];
  for (const slot of ir.slots) {
    const ctx = buildSlotCtx(slot);
    interfaceDecls.push(ctx.interfaceDecl);
    slotFieldDecls.push(ctx.fieldDecl);
  }

  // 6. Build field declarations.
  const fieldLines: string[] = [];

  // 6a. Props: model() vs input().
  for (const p of ir.props) {
    const tsType = renderType(p.typeAnnotation);
    const defaultVal = renderDefault(p);
    const fnName = p.isModel ? 'model' : 'input';
    if (defaultVal) {
      fieldLines.push(`${p.name} = ${fnName}<${tsType}>(${defaultVal});`);
    } else {
      // No default — `input.required<T>()` for non-model, `model.required<T>()` for model
      fieldLines.push(`${p.name} = ${fnName}.required<${tsType}>();`);
    }
  }

  // 6b. State signals.
  for (const s of ir.state) {
    const initText = genCode(s.initializer);
    fieldLines.push(`${s.name} = signal(${initText});`);
  }

  // 6c. RefDecls — viewChild signals.
  for (const r of ir.refs) {
    let domType = 'HTMLElement';
    switch (r.elementTag.toLowerCase()) {
      case 'input':
        domType = 'HTMLInputElement';
        break;
      case 'textarea':
        domType = 'HTMLTextAreaElement';
        break;
      case 'select':
        domType = 'HTMLSelectElement';
        break;
      case 'button':
        domType = 'HTMLButtonElement';
        break;
      case 'form':
        domType = 'HTMLFormElement';
        break;
      case 'div':
        domType = 'HTMLDivElement';
        break;
    }
    fieldLines.push(`${r.name} = viewChild<ElementRef<${domType}>>('${r.name}');`);
  }

  // 6d. Output emits.
  for (const e of ir.emits) {
    fieldLines.push(`${e} = output<unknown>();`);
  }

  // 6e. @ContentChild slot tpl fields.
  for (const decl of slotFieldDecls) {
    fieldLines.push(decl);
  }

  // 7. Build computed properties.
  const computedLines: string[] = [];
  for (const c of ir.computed) {
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    const bodyCode = genCode(body);
    computedLines.push(`${c.name} = computed(() => ${bodyCode});`);
  }

  // 8. Build lifecycle effect blocks for the constructor body.
  const lifecycleConstructorLines: string[] = [];
  for (const hook of lifecyclePairing.perHook) {
    lifecycleConstructorLines.push(
      renderLifecycleHook(hook, rewriteResult.classMembers, rewriteResult.collisionRenames),
    );
  }

  // 9. Build residual user-script body — methods/arrows go at CLASS level
  //    (so they're invokable via `this.name(...)`); top-level statements
  //    (console.log, expression-statements) go in the constructor body.
  const classMethodLines: string[] = [];
  const constructorExpressionLines: string[] = [];

  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;

    // Skip $computed VariableDeclarations (consumed above).
    if (t.isVariableDeclaration(stmt)) {
      const allComputed =
        stmt.declarations.length > 0 &&
        stmt.declarations.every(
          (d) =>
            d.init &&
            t.isCallExpression(d.init) &&
            t.isIdentifier(d.init.callee) &&
            d.init.callee.name === '$computed',
        );
      if (allComputed) continue;

      // For each declarator that's an arrow/function-expression, emit as a
      // class-level arrow field. Other declarators (e.g., let/const with
      // primitive values) go to the constructor body.
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id) || !d.init) {
          // Multi-declarator non-identifier — fall back to constructor.
          constructorExpressionLines.push(genCode(stmt));
          break;
        }
        if (
          t.isArrowFunctionExpression(d.init) ||
          t.isFunctionExpression(d.init)
        ) {
          // Emit as class-level arrow field.
          const arrowCode = genCode(d.init);
          classMethodLines.push(`${d.id.name} = ${arrowCode};`);
        } else {
          // Primitive / other init — emit as class-level field too. Class fields
          // initialized at field declaration time match user intent ("this is
          // module-level state").
          const initCode = genCode(d.init);
          classMethodLines.push(`${d.id.name} = ${initCode};`);
        }
      }
      continue;
    }

    // FunctionDeclaration → class method.
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      // Convert `function foo() {...}` → arrow class field.
      const fnCode = genCode(
        t.arrowFunctionExpression(
          stmt.params,
          stmt.body,
          stmt.async ?? false,
        ),
      );
      classMethodLines.push(`${stmt.id.name} = ${fnCode};`);
      continue;
    }

    // ExpressionStatements (console.log, $emit calls, etc.) → constructor body.
    if (t.isExpressionStatement(stmt)) {
      // Already filtered $onMount/$onUnmount/$onUpdate above (consumed).
      // Remaining ExpressionStatements: e.g., `console.log("hello from rozie")`.
      constructorExpressionLines.push(genCode(stmt));
      continue;
    }

    // Fallback: emit verbatim into constructor.
    constructorExpressionLines.push(genCode(stmt));
  }

  // 10. Assemble the constructor body.
  // Order:
  //   inject(Renderer2) / inject(DestroyRef) consts (only if needed)
  //   user residual top-level statements (console.log etc.)
  //   lifecycle hook calls (paired-cleanup form)
  //   listener effect blocks (Plan 05-04a Task 3 splices in)
  const constructorBodyLines: string[] = [];

  // Note: we do NOT preemptively inject Renderer2/DestroyRef here — the
  // listener emitter (Task 3) will splice its own `inject(Renderer2)` / `inject(DestroyRef)`
  // lines into the constructor as needed. For lifecycle-only components,
  // `inject(DestroyRef).onDestroy(...)` calls are inlined directly.

  for (const line of constructorExpressionLines) {
    constructorBodyLines.push(line);
  }
  for (const line of lifecycleConstructorLines) {
    constructorBodyLines.push(line);
  }

  // 11. Build the final class body.
  const classBodyParts: string[] = [];
  if (fieldLines.length > 0) {
    classBodyParts.push(fieldLines.join('\n'));
  }
  if (constructorBodyLines.length > 0) {
    const indented = constructorBodyLines
      .map((l) =>
        l
          .split('\n')
          .map((line) => (line.length > 0 ? '  ' + line : line))
          .join('\n'),
      )
      .join('\n');
    classBodyParts.push(`constructor() {\n${indented}\n}`);
  }
  if (computedLines.length > 0) {
    classBodyParts.push(computedLines.join('\n'));
  }
  if (classMethodLines.length > 0) {
    classBodyParts.push(classMethodLines.join('\n'));
  }

  // ngTemplateContextGuard static method (only if slots present).
  const guardMethod = buildNgTemplateContextGuard(ir.name, ir.slots);
  if (guardMethod) {
    classBodyParts.push(guardMethod);
  }

  const classBody = classBodyParts.join('\n\n');

  // Phase 06.1 P2: scriptMap=null for v1 — see EmitScriptResult.scriptMap docstring.
  const scriptMap: EncodedSourceMap | null = null;
  return { classBody, imports, interfaceDecls, scriptMap, diagnostics };
}

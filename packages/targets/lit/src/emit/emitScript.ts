/**
 * emitScript — Lit target (Plan 06.4-02 Task 1).
 *
 * Produces the class-body fragments for a Lit element:
 *   - @property/@state class fields for props + data
 *   - @query class fields for refs
 *   - getter methods for $computed declarations
 *   - user-authored top-level function declarations / variables as class methods
 *   - lifecycle dispatch: $onMount → firstUpdated(), $onUnmount → disconnected,
 *     $onUpdate → updated(), D-19 cleanup-return → push to _disconnectCleanups
 *   - model-prop synthesis: createLitControllableProperty + setter + change-event
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
  LifecycleHook,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { rewriteScript, collectMethodNamesFromProgram } from '../rewrite/rewriteScript.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { toKebabCase } from './emitDecorator.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

export interface EmitScriptOpts {
  decorators: LitDecoratorImportCollector;
  signals: PreactSignalsImportCollector;
  runtime: RuntimeLitImportCollector;
  lit: LitImportCollector;
}

export interface EmitScriptResult {
  /** Class field declarations (props + state + refs + signal-wrapped data). */
  fieldDecls: string;
  /** Class method declarations (computed getters + user methods + model setters). */
  methodDecls: string;
  /** firstUpdated body — $onMount calls in source order. */
  mountHookBody: string;
  /** disconnectedCallback body — $onUnmount calls (super + cleanup drain is added by orchestrator). */
  unmountHookBody: string;
  /** updated() body — $onUpdate calls. */
  updateHookBody: string;
  /** attributeChangedCallback body (for model-prop notifyAttributeChange). */
  attributeChangedBody: string;
  /** Source map for user-authored statements (unused in P2 — null). */
  scriptMap: EncodedSourceMap | null;
  /** Number of preamble lines (unused in P2). */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

function renderType(t: PropTypeAnnotation): string {
  if (t.kind === 'identifier') {
    switch (t.name) {
      case 'Number': return 'Number';
      case 'String': return 'String';
      case 'Boolean': return 'Boolean';
      case 'Array': return 'Array';
      case 'Object': return 'Object';
      case 'Function': return 'Function';
      default: return 'Object';
    }
  }
  if (t.kind === 'union') {
    // Lit @property accepts one type token; pick the first.
    if (t.members.length > 0) return renderType(t.members[0]!);
  }
  return 'Object';
}

function renderTsType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number': return 'number';
      case 'String': return 'string';
      case 'Boolean': return 'boolean';
      case 'Array': return 'unknown[]';
      case 'Object': return 'object';
      case 'Function': return '((...args: unknown[]) => unknown) | null';
      default: return 'unknown';
    }
  }
  if (ann.kind === 'union') {
    return ann.members.map(renderTsType).join(' | ');
  }
  return 'unknown';
}

function isPrimitiveType(ann: PropTypeAnnotation): boolean {
  if (ann.kind === 'identifier') {
    return ann.name === 'Number' || ann.name === 'String' || ann.name === 'Boolean';
  }
  return false;
}

function renderExpression(expr: t.Expression): string {
  return generate(expr, GEN_OPTS).code;
}

function renderDefault(expr: t.Expression | null, ann: PropTypeAnnotation): string {
  if (expr) {
    // Arrow factory wrapping (Vue-style `default: () => []`) — emit the wrapped
    // body's resolved expression directly because Lit @property accepts a
    // plain default value, not a factory function.
    if (t.isArrowFunctionExpression(expr) && t.isExpression(expr.body)) {
      return renderExpression(expr.body);
    }
    if (t.isFunctionExpression(expr) && expr.body.body.length === 1) {
      const stmt = expr.body.body[0]!;
      if (t.isReturnStatement(stmt) && stmt.argument) {
        return renderExpression(stmt.argument);
      }
    }
    return renderExpression(expr);
  }
  // Fallback default per type.
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number': return '0';
      case 'String': return "''";
      case 'Boolean': return 'false';
      case 'Array': return '[]';
      case 'Object': return '{}';
      case 'Function': return 'null';
    }
  }
  return 'undefined';
}

function emitNonModelProp(prop: PropDecl): string {
  const litType = renderType(prop.typeAnnotation);
  const tsType = renderTsType(prop.typeAnnotation);
  const reflect = isPrimitiveType(prop.typeAnnotation);
  const reflectField = reflect ? ', reflect: true' : '';
  const defaultStr = renderDefault(prop.defaultValue, prop.typeAnnotation);
  return `  @property({ type: ${litType}${reflectField} }) ${prop.name}: ${tsType} = ${defaultStr};`;
}

interface ModelPropEmit {
  fieldDecl: string;
  controllableInit: string;
  attrCallback: string;
}

function emitModelProp(prop: PropDecl, componentName: string): ModelPropEmit {
  const litType = renderType(prop.typeAnnotation);
  const tsType = renderTsType(prop.typeAnnotation);
  const reflect = isPrimitiveType(prop.typeAnnotation);
  const reflectField = reflect ? ', reflect: true' : '';
  const defaultStr = renderDefault(prop.defaultValue, prop.typeAnnotation);
  const eventName = `${toKebabCase(prop.name)}-change`;
  const attrName = toKebabCase(prop.name);

  // We emit an @property attribute mirror, plus a private controllable backing.
  // Public getter/setter goes into methodDecls.
  const fieldDecl = [
    `  @property({ type: ${litType}${reflectField}, attribute: '${attrName}' }) _${prop.name}_attr: ${tsType} = ${defaultStr};`,
    `  private _${prop.name}Controllable = createLitControllableProperty<${tsType}>({ host: this, eventName: '${eventName}', defaultValue: ${defaultStr}, initialControlledValue: undefined });`,
  ].join('\n');

  const controllableInit = ''; // already initialized in field init

  // attributeChangedCallback body — when attribute changes, push to controllable.
  const coerce =
    litType === 'Number'
      ? `value === null ? ${defaultStr} : Number(value)`
      : litType === 'Boolean'
        ? `value !== null`
        : `value as unknown as ${tsType}`;
  const attrCallback = `if (name === '${attrName}') this._${prop.name}Controllable.notifyAttributeChange(${coerce});`;

  void componentName;
  return { fieldDecl, controllableInit, attrCallback };
}

function emitModelGetterSetter(prop: PropDecl): string {
  const tsType = renderTsType(prop.typeAnnotation);
  return [
    `  get ${prop.name}(): ${tsType} { return this._${prop.name}Controllable.read(); }`,
    `  set ${prop.name}(v: ${tsType}) { this._${prop.name}Controllable.write(v); }`,
  ].join('\n');
}

function emitStateField(stateName: string, init: t.Expression): string {
  // Signal-backed: `private _x = signal(<init>);`
  return `  private _${stateName} = signal(${renderExpression(init)});`;
}

function emitRefField(refName: string, elementTag: string): string {
  // @query targets refs by data-rozie-ref="<name>" (Plan 06.4-02 inference).
  // The selector pinned by data attribute keeps shadow-DOM scoping correct.
  // Mark with definite-assignment in case the consumer hasn't yet rendered.
  void elementTag;
  const field = `_ref${refName.charAt(0).toUpperCase()}${refName.slice(1)}`;
  return `  @query('[data-rozie-ref="${refName}"]') private ${field}!: HTMLElement;`;
}

function isLifecycleCall(stmt: t.Statement): {
  isHook: boolean;
  hookName?: '$onMount' | '$onUnmount' | '$onUpdate';
  argument?: t.Expression;
} {
  if (!t.isExpressionStatement(stmt)) return { isHook: false };
  const expr = stmt.expression;
  if (!t.isCallExpression(expr)) return { isHook: false };
  if (!t.isIdentifier(expr.callee)) return { isHook: false };
  const name = expr.callee.name;
  if (name !== '$onMount' && name !== '$onUnmount' && name !== '$onUpdate') {
    return { isHook: false };
  }
  if (expr.arguments.length === 0) return { isHook: false };
  const arg = expr.arguments[0]!;
  if (!t.isExpression(arg)) return { isHook: false };
  return { isHook: true, hookName: name, argument: arg };
}

/**
 * Inline a hook callback's body into the lifecycle method.
 * If the arg is an arrow function with a block body, return the body's statements
 * as a string. If it's an identifier, return `<name>();`. Cleanup return-values
 * are stripped and pushed to _disconnectCleanups.
 */
function inlineHookBody(arg: t.Expression): { body: string; cleanup: string } {
  if (t.isIdentifier(arg)) {
    return { body: `${arg.name}();`, cleanup: '' };
  }
  if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
    const body = arg.body;
    if (t.isBlockStatement(body)) {
      // Look for trailing `return fn` — peel off as cleanup.
      const stmts = [...body.body];
      let cleanup = '';
      if (stmts.length > 0) {
        const last = stmts[stmts.length - 1]!;
        if (t.isReturnStatement(last) && last.argument) {
          cleanup = renderExpression(last.argument);
          stmts.pop();
        }
      }
      const rendered = stmts.map((s) => generate(s, GEN_OPTS).code).join('\n');
      return { body: rendered, cleanup };
    }
    // Concise arrow: () => expr
    return { body: `${renderExpression(body as t.Expression)};`, cleanup: '' };
  }
  return { body: `(${renderExpression(arg)})();`, cleanup: '' };
}

interface PartitionedScript {
  /** Top-level statements that should become class methods/getters. */
  classLevelStmts: t.Statement[];
  /** $onMount calls in source order. */
  mountHooks: Array<{ arg: t.Expression }>;
  /** $onUnmount calls. */
  unmountHooks: Array<{ arg: t.Expression }>;
  /** $onUpdate calls. */
  updateHooks: Array<{ arg: t.Expression }>;
}

function partitionScript(program: t.File): PartitionedScript {
  const classLevelStmts: t.Statement[] = [];
  const mountHooks: PartitionedScript['mountHooks'] = [];
  const unmountHooks: PartitionedScript['unmountHooks'] = [];
  const updateHooks: PartitionedScript['updateHooks'] = [];

  for (const stmt of program.program.body) {
    const hook = isLifecycleCall(stmt);
    if (hook.isHook && hook.argument) {
      const entry = { arg: hook.argument };
      if (hook.hookName === '$onMount') mountHooks.push(entry);
      else if (hook.hookName === '$onUnmount') unmountHooks.push(entry);
      else if (hook.hookName === '$onUpdate') updateHooks.push(entry);
      continue;
    }
    classLevelStmts.push(stmt);
  }

  return { classLevelStmts, mountHooks, unmountHooks, updateHooks };
}

/**
 * Convert a top-level variable declaration into a class field or class method.
 *
 * Rules:
 *   - `const X = $computed(() => expr)` → `get X() { return expr; }` (getter)
 *   - `const X = () => { ... }` → `X = () => { ... };` (class field-arrow)
 *   - `let X = ...` / `const X = ...` (non-arrow) → `X = ...;` (class field)
 *   - `function X() { ... }` → `X() { ... }` (class method)
 *
 * `console.log(...)` and other free expression statements become initialization
 * statements inside the field-init for a private dummy (rare and benign for
 * code-library audience).
 */
function classBodyFromStatements(
  stmts: t.Statement[],
  computedNames: Set<string>,
): { methods: string; freeStatements: string } {
  const methodChunks: string[] = [];
  const freeChunks: string[] = [];

  for (const stmt of stmts) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id) || !decl.init) continue;
        const name = decl.id.name;

        // $computed(() => expr) → getter method
        if (
          computedNames.has(name) &&
          t.isCallExpression(decl.init) &&
          t.isIdentifier(decl.init.callee) &&
          decl.init.callee.name === '$computed' &&
          decl.init.arguments.length > 0
        ) {
          const arrow = decl.init.arguments[0]!;
          if (t.isArrowFunctionExpression(arrow) || t.isFunctionExpression(arrow)) {
            if (t.isExpression(arrow.body)) {
              methodChunks.push(
                `  get ${name}() { return ${renderExpression(arrow.body)}; }`,
              );
            } else if (t.isBlockStatement(arrow.body)) {
              const bodyCode = arrow.body.body
                .map((s) => generate(s, GEN_OPTS).code)
                .join('\n');
              methodChunks.push(
                `  get ${name}() {\n${indent(bodyCode, 4)}\n  }`,
              );
            }
            continue;
          }
        }

        // Arrow functions become field-arrows (preserve `this` binding semantics)
        if (
          t.isArrowFunctionExpression(decl.init) ||
          t.isFunctionExpression(decl.init)
        ) {
          // Render as `name = (args) => body;` (preserves arrow lexical this)
          const code = renderExpression(decl.init);
          methodChunks.push(`  ${name} = ${code};`);
          continue;
        }

        // Plain value initializer → class field
        methodChunks.push(`  ${name} = ${renderExpression(decl.init)};`);
      }
      continue;
    }

    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      const name = stmt.id.name;
      const params = stmt.params.map((p) => renderExpression(p as t.Expression)).join(', ');
      const body = stmt.body.body.map((s) => generate(s, GEN_OPTS).code).join('\n');
      methodChunks.push(`  ${name}(${params}) {\n${indent(body, 4)}\n  }`);
      continue;
    }

    // Free expression statement (e.g. console.log) — move into firstUpdated.
    freeChunks.push(generate(stmt, GEN_OPTS).code);
  }

  return {
    methods: methodChunks.join('\n\n'),
    freeStatements: freeChunks.join('\n'),
  };
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

/**
 * Inline a lifecycle hook from the IR's LifecycleHook list (paired form).
 * The IR already pairs $onMount/$onUnmount via the lowerer (D-19).
 *
 * Each hook's setup/cleanup expression is wrapped into a synthetic Babel File
 * + Program and run through rewriteScript so $props.X / $data.X / $refs.X /
 * top-level method names get rewritten to `this.X` form. Then the body is
 * rendered with @babel/generator.
 */
function lifecycleHookBody(
  hook: LifecycleHook,
  ir: IRComponent,
  methodNames: Set<string>,
): { body: string; cleanup: string } {
  let body = '';
  if (t.isBlockStatement(hook.setup)) {
    const wrapper = t.file(t.program([...hook.setup.body]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames });
    body = rewritten.file.program.body.map((s) => generate(s, GEN_OPTS).code).join('\n');
  } else if (t.isExpression(hook.setup)) {
    const call = t.callExpression(t.cloneNode(hook.setup, true, false), []);
    const wrapper = t.file(t.program([t.expressionStatement(call)]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames });
    body = rewritten.file.program.body.map((s) => generate(s, GEN_OPTS).code).join('\n');
  }

  let cleanup = '';
  if (hook.cleanup) {
    // Preserve multi-line shape — rewriteTemplateExpression flattens newlines
    // which can swallow line-comments inside arrow bodies. Use rewriteScript
    // over a wrapper file + multi-line generator instead.
    const cleanupClone = t.cloneNode(hook.cleanup, true, false);
    const wrapper = t.file(t.program([t.expressionStatement(cleanupClone)]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames });
    const stmt = rewritten.file.program.body[0]!;
    if (t.isExpressionStatement(stmt)) {
      cleanup = generate(stmt.expression, GEN_OPTS).code;
    }
  }

  return { body, cleanup };
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOpts,
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];

  // Decorator imports we always need.
  if (ir.props.length > 0) opts.decorators.add('property');
  if (ir.state.length > 0) opts.signals.add('signal');
  if (ir.refs.length > 0) opts.decorators.add('query');

  // Track model props — need controllable helper + dispatch.
  const modelProps = ir.props.filter((p) => p.isModel);
  if (modelProps.length > 0) opts.runtime.add('createLitControllableProperty');

  // 1. Field declarations.
  const fieldLines: string[] = [];
  const attrCallbackLines: string[] = [];

  for (const prop of ir.props) {
    if (prop.isModel) {
      const emit = emitModelProp(prop, ir.name);
      fieldLines.push(emit.fieldDecl);
      attrCallbackLines.push(emit.attrCallback);
    } else {
      fieldLines.push(emitNonModelProp(prop));
    }
  }

  for (const state of ir.state) {
    fieldLines.push(emitStateField(state.name, state.initializer));
  }

  for (const ref of ir.refs) {
    fieldLines.push(emitRefField(ref.name, ref.elementTag));
  }

  // 2. Rewrite the script Babel AST so $props.X / $data.X / etc. become this.X
  // before we render statements out.
  const rewritten = rewriteScript(ir.setupBody.scriptProgram, ir);

  // 3. Partition the rewritten program into class-level vs lifecycle.
  const partition = partitionScript(rewritten.file);

  const computedNames = new Set(ir.computed.map((c) => c.name));
  const { methods: classMethodsFromScript, freeStatements } = classBodyFromStatements(
    partition.classLevelStmts,
    computedNames,
  );

  // 4. Model-prop getter/setter pair → methods.
  const modelMethodLines: string[] = modelProps.map(emitModelGetterSetter);

  const methodDecls = [classMethodsFromScript, modelMethodLines.join('\n')]
    .filter((s) => s.trim().length > 0)
    .join('\n\n');

  // 5. Lifecycle hook routing — IR-level hooks (paired by lowerScript) take
  // precedence; in addition, $onMount/$onUnmount/$onUpdate calls in the script
  // body (partitioned above) are inlined in source order.
  const mountBodies: string[] = [];
  const unmountBodies: string[] = [];
  const updateBodies: string[] = [];
  const cleanupPushes: string[] = [];

  // If IR provides paired lifecycle, prefer it for emission.
  // Collect method names from the original IR script program so identifiers
  // in lifecycle hooks get rewritten to `this.X`.
  const methodNames = collectMethodNamesFromProgram(ir.setupBody.scriptProgram, ir);
  if (ir.lifecycle && ir.lifecycle.length > 0) {
    for (const hook of ir.lifecycle) {
      const { body, cleanup } = lifecycleHookBody(hook, ir, methodNames);
      if (hook.phase === 'mount') {
        if (body.trim()) mountBodies.push(body);
        if (cleanup) {
          cleanupPushes.push(`this._disconnectCleanups.push((${cleanup}));`);
        }
      } else if (hook.phase === 'unmount') {
        if (body.trim()) unmountBodies.push(body);
      } else if (hook.phase === 'update') {
        if (body.trim()) updateBodies.push(body);
      }
    }
  } else {
    // Fall back to inlining partition hooks directly.
    for (const h of partition.mountHooks) {
      const { body, cleanup } = inlineHookBody(h.arg);
      if (body.trim()) mountBodies.push(body);
      if (cleanup) {
        cleanupPushes.push(`this._disconnectCleanups.push((${cleanup}));`);
      }
    }
    for (const h of partition.unmountHooks) {
      const { body } = inlineHookBody(h.arg);
      if (body.trim()) unmountBodies.push(body);
    }
    for (const h of partition.updateHooks) {
      const { body } = inlineHookBody(h.arg);
      if (body.trim()) updateBodies.push(body);
    }
  }

  // 6. firstUpdated body: free-statement preamble + cleanup pushes + mount hooks.
  // Free statements (e.g. console.log) run once at first paint.
  const mountSegments: string[] = [];
  if (freeStatements.trim()) mountSegments.push(freeStatements);
  if (cleanupPushes.length > 0) mountSegments.push(cleanupPushes.join('\n'));
  for (const body of mountBodies) mountSegments.push(body);

  return {
    fieldDecls: fieldLines.join('\n'),
    methodDecls,
    mountHookBody: mountSegments.join('\n\n'),
    unmountHookBody: unmountBodies.join('\n\n'),
    updateHookBody: updateBodies.join('\n\n'),
    attributeChangedBody: attrCallbackLines.join('\n'),
    scriptMap: null,
    preambleSectionLines: 0,
    diagnostics,
  };
}

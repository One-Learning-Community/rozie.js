/**
 * synthesizeHandleType — Phase 21 ($expose), Cluster C / D-04 / REQ-10.
 *
 * Renders the `<Name>Handle` TypeScript interface from the `<script>` function
 * signatures of an IRComponent's exposed methods. A core-shared helper consumed
 * by the React (`.tsx` inline interface + `.d.ts` from emitTypes.ts) and Solid
 * (inline `ref?: (h: <Name>Handle) => void` prop type) emitters in Wave 2.
 *
 * Philosophy (mirrors `typeNeutralizeScript`, NOT modifying it): preserve author
 * annotations; fill untyped residue with `any`.
 *   - A typed method (author wrote `function setDate(d: Date): void` or
 *     `const reset = (): void => ...` in `<script lang="ts">`) → emit the real
 *     method signature `setDate(d: Date): void;`.
 *   - An untyped method → emit `(...args: any[]) => any` (D-04 fallback). This
 *     is a TYPE, not a cast — no `@ts-ignore` / `as any` is introduced (REQ-10).
 *
 * "Typed" is detected by the presence of an explicit author return-type
 * annotation on the function/arrow. (Untyped `<script>` functions never carry
 * one; `typeNeutralizeScript` stamps `: any` onto untyped PARAMS but never
 * synthesizes a return type, so the return annotation is a reliable
 * author-typed signal.)
 *
 * Returns `null` when `ir.expose` is empty (callers skip emission entirely).
 * Does NOT prepend `export` — callers add it inline (`.tsx`) or for the `.d.ts`
 * surface as needed.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { IRComponent } from '../ir/types.js';

// Default-export interop (see collectScriptDecls.ts).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

/** A function-like node whose signature we can read. */
type FnLike =
  | t.FunctionDeclaration
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.ObjectMethod;

const UNTYPED_METHOD = '(...args: any[]) => any';

/**
 * Build a map of top-level `<script>` function declarations by name:
 *   - `function reset() {}` → FunctionDeclaration
 *   - `const reset = (...) => {}` / `const reset = function () {}` → the init.
 * A `$computed(...)`-bound const is intentionally excluded (reactive value).
 */
function collectScriptFunctions(ir: IRComponent): Map<string, FnLike> {
  const out = new Map<string, FnLike>();
  const body = ir.setupBody.scriptProgram.program.body;
  for (const stmt of body) {
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      out.set(stmt.id.name, stmt);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id)) continue;
        const init = decl.init;
        if (
          init &&
          (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
        ) {
          out.set(decl.id.name, init);
        }
      }
    }
  }
  return out;
}

/**
 * Find inline `$expose({ name: () => ... })` arrow/function values so a method
 * exposed only as an inline expression still contributes its signature.
 */
function collectInlineExposeFns(ir: IRComponent): Map<string, FnLike> {
  const out = new Map<string, FnLike>();
  const body = ir.setupBody.scriptProgram.program.body;
  for (const stmt of body) {
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (
      !t.isCallExpression(expr) ||
      !t.isIdentifier(expr.callee) ||
      expr.callee.name !== '$expose'
    ) {
      continue;
    }
    const arg = expr.arguments[0];
    if (!arg || !t.isObjectExpression(arg)) continue;
    for (const prop of arg.properties) {
      if (t.isObjectMethod(prop) && !prop.computed && t.isIdentifier(prop.key)) {
        out.set(prop.key.name, prop);
        continue;
      }
      if (t.isObjectProperty(prop) && !prop.computed && t.isIdentifier(prop.key)) {
        const value = prop.value;
        if (
          t.isArrowFunctionExpression(value) ||
          t.isFunctionExpression(value)
        ) {
          out.set(prop.key.name, value);
        }
      }
    }
  }
  return out;
}

/** Generate the TS source for a node fragment (type annotation inner type). */
function gen(node: t.Node): string {
  return generate(node, { concise: true }).code;
}

/**
 * Render one function parameter, preserving its author type annotation.
 *
 * `@babel/generator` does NOT print a param's `typeAnnotation` when the param
 * node is generated STANDALONE (annotations only print inside a full function
 * context), so we render the binding and its `: <type>` annotation explicitly.
 * Handles Identifier / RestElement / patterns with an attached annotation.
 */
function renderParam(param: t.Node): string {
  // The binding text (name, destructuring pattern, rest) without annotation.
  let typeAnnotation: t.TSTypeAnnotation | null = null;
  if (
    (t.isIdentifier(param) ||
      t.isRestElement(param) ||
      t.isObjectPattern(param) ||
      t.isArrayPattern(param) ||
      t.isAssignmentPattern(param)) &&
    param.typeAnnotation &&
    t.isTSTypeAnnotation(param.typeAnnotation)
  ) {
    typeAnnotation = param.typeAnnotation;
  }

  // Generate the binding alone, then strip any annotation the generator did
  // include (it omits it for Identifier but may include it for patterns) and
  // re-append our explicit one for a single consistent shape.
  const bindingOnly = gen(stripTypeAnnotation(param));
  if (!typeAnnotation) return bindingOnly;
  return `${bindingOnly}: ${gen(typeAnnotation.typeAnnotation)}`;
}

/** Return a shallow clone of a param node with its typeAnnotation removed. */
function stripTypeAnnotation(param: t.Node): t.Node {
  if (
    'typeAnnotation' in param &&
    (param as { typeAnnotation?: unknown }).typeAnnotation
  ) {
    return { ...(param as object), typeAnnotation: null } as t.Node;
  }
  return param;
}

/**
 * Does this function carry an author-written return-type annotation? That is the
 * reliable "typed by the author" signal — untyped `<script>` functions never
 * have one (typeNeutralizeScript only fills params).
 */
function hasAuthorReturnType(fn: FnLike): boolean {
  return fn.returnType != null && t.isTSTypeAnnotation(fn.returnType);
}

/**
 * Render one method member line for the interface body.
 *   typed   → `name(<params>): <ret>;`
 *   untyped → `name: (...args: any[]) => any;`
 */
function renderMember(name: string, fn: FnLike | undefined): string {
  if (fn && hasAuthorReturnType(fn)) {
    const params = fn.params.map((p) => renderParam(p)).join(', ');
    // Generate the inner TSType (not the TSTypeAnnotation wrapper — @babel/
    // generator cannot print a bare annotation node standalone).
    const retType = gen((fn.returnType as t.TSTypeAnnotation).typeAnnotation);
    return `  ${name}(${params}): ${retType};`;
  }
  return `  ${name}: ${UNTYPED_METHOD};`;
}

/**
 * Synthesize the `<Name>Handle` interface string, or `null` when nothing is
 * exposed.
 *
 * @param ir - the lowered component (its `expose` field + `<script>` AST).
 * @param interfaceName - the interface name (e.g. `ExposeProbeHandle`).
 */
export function synthesizeHandleType(
  ir: IRComponent,
  interfaceName: string,
): string | null {
  if (ir.expose.length === 0) return null;

  const scriptFns = collectScriptFunctions(ir);
  const inlineFns = collectInlineExposeFns(ir);

  const members = ir.expose.map((method) => {
    const fn = scriptFns.get(method.name) ?? inlineFns.get(method.name);
    return renderMember(method.name, fn);
  });

  return `interface ${interfaceName} {\n${members.join('\n')}\n}`;
}

/**
 * emitScript — Phase 3 Plan 02 Task 2.
 *
 * Produces the body of `<script setup lang="ts">` for a Vue 3.4+ SFC. Output
 * order (per RESEARCH.md Pattern 3 + plan §<action>):
 *
 *   1. import { ... } from 'vue'        (auto-collected)
 *   2. withDefaults(defineProps<...>(), { ... })  (non-model props only — D-31)
 *   3. const X = defineModel<T>('X', { ... })     (per model prop — D-31, Pitfall 3)
 *   4. const emit = defineEmits<...>()            (only when ir.emits non-empty)
 *   5. defineSlots<...>()                         (only when ir.slots non-empty)
 *   6. const x = ref(initial)                     (per StateDecl — D-32)
 *   7. const xRef = ref<HTMLElement>()            (per RefDecl — Pitfall 4)
 *   8. const c = computed(() => body)             (per ComputedDecl — D-34)
 *   9. residual script body                       (helper-fn, plain-decl, console.log)
 *  10. onMounted/onBeforeUnmount/onUpdated calls  (D-33 + Pitfall 5/10)
 *
 * NOTE: residual-before-lifecycle ordering (since Plan 06) — earlier the doc
 * said lifecycle came BEFORE residual, but that triggered a JS TDZ crash on
 * `onMounted(lockScroll)` where `lockScroll` is a `const` declared in the
 * residual body (Modal.rozie repro). Vue's lifecycle registration doesn't
 * care which order setup executes the calls — it only cares that they fire
 * synchronously during setup, which both orderings satisfy.
 *
 * @rozie/runtime-vue imports for non-native modifiers (.outside / .debounce
 * / .throttle) come from Plan 04 (P3) which adds the listeners-block lowering
 * surface. Plan 02 emits ZERO non-native modifier code.
 *
 * Per CONTEXT D-30 hybrid codegen: <script> body is rewritten via
 * @babel/traverse over a CLONED Babel Program, then printed with
 * @babel/generator. The TOP-LEVEL string assembly is template-builder.
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
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { VueImportCollector } from '../rewrite/collectVueImports.js';
import { buildSlotTypeBlock } from './refineSlotTypes.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations below (D-104/D-106)
// give those maps real positional content; non-annotated scaffolding nodes
// fall back to nearest-segment via the surrounding shell map (D-102).
//
// v1 limitation: emitScript assembles its output via string concatenation
// across multiple genCode calls (one per IR primitive). A single consolidated
// child map covering the whole script body would require building one
// t.Program and emitting once — large architectural change deferred. v1
// surfaces scriptMap=null and relies on the buildShell per-block accuracy
// (DX-04 P1 floor); the sourceMaps:true switch + .loc annotations give v2 a
// drop-in upgrade path.
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
  sourceFileName: '<rozie>',
};

// Used only when emitting the residual (user-authored) statement block with
// source maps — a single t.Program generate call so we get one coherent map.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * Render a PropTypeAnnotation as a TypeScript type string.
 *
 * Reference examples produce these patterns:
 *   - { kind: 'identifier', name: 'Number' }   → 'number'
 *   - { kind: 'identifier', name: 'String' }   → 'string'
 *   - { kind: 'identifier', name: 'Boolean' }  → 'boolean'
 *   - { kind: 'identifier', name: 'Array' }    → 'unknown[]'
 *   - { kind: 'identifier', name: 'Object' }   → 'unknown'
 *   - { kind: 'identifier', name: 'Function' } → '(...args: any[]) => any'
 *   - { kind: 'union', members: [...] }        → join with ' | '
 *   - { kind: 'literal', value: 'string' }     → 'string'
 *
 * Other identifier names pass through verbatim (e.g., user-declared interface
 * names) — TS will validate at consumer compile time.
 */
function renderType(t: PropTypeAnnotation): string {
  if (t.kind === 'identifier') {
    switch (t.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'unknown[]';
      case 'Object':
        return 'unknown';
      case 'Function':
        return '(...args: any[]) => any';
      default:
        return t.name; // Pass through user-declared types verbatim.
    }
  }
  if (t.kind === 'union') {
    return t.members.map(renderType).join(' | ');
  }
  if (t.kind === 'literal') {
    // 'string'|'number'|'boolean'|'function'|'object'|'array'
    if (t.value === 'array') return 'unknown[]';
    if (t.value === 'object') return 'unknown';
    if (t.value === 'function') return '(...args: any[]) => any';
    return t.value;
  }
  // Should be exhaustive — but fall back to 'unknown' for safety.
  return 'unknown';
}

/**
 * Emit `withDefaults(defineProps<{...}>(), { ... })` for non-model props.
 * Returns empty string when no non-model props exist.
 *
 * D-85 Vue full (Plan 06-02 Task 3): when `genericParams` is set, the inline
 * type literal becomes a parameterized interface `${Name}Props<T, ...>` so
 * that Vue's `<script setup generic="T">` attribute can resolve `T` inside
 * the props type-arg. The interface declaration is hoisted above the
 * `defineProps` call.
 */
function emitPropsDecl(
  ir: IRComponent,
  genericParams?: readonly string[],
): string {
  const nonModel = ir.props.filter((p) => !p.isModel);
  const generics =
    genericParams && genericParams.length > 0
      ? `<${genericParams.join(', ')}>`
      : '';

  if (nonModel.length === 0) {
    // Generic components with NO non-model props still need a typed
    // `defineProps<FooProps<T>>()` so consumers can pass the type argument.
    // But if there are no model props EITHER, emitDefineModels will emit
    // nothing too — which means the SFC has no defineProps at all and the
    // generic attribute on <script setup> is effectively unused. This
    // is fine for v1: the only generic fixture (Select<T>) has a model prop
    // so defineModel<T> uses T.
    return '';
  }

  const fields = nonModel.map(
    (p) => `${p.name}?: ${renderType(p.typeAnnotation)}`,
  );

  // Build the defaults object — only include props with non-null defaultValue.
  const defaultsEntries: string[] = [];
  for (const p of nonModel) {
    if (p.defaultValue !== null) {
      defaultsEntries.push(`${p.name}: ${genCode(p.defaultValue)}`);
    }
  }

  // Generic-mode: hoist a named interface so `defineProps<SelectProps<T>>()`
  // resolves T against the enclosing <script setup generic="T"> attribute.
  if (generics.length > 0) {
    const interfaceLine = `interface ${ir.name}Props${generics} { ${fields.join('; ')} }`;
    if (defaultsEntries.length === 0) {
      return (
        `${interfaceLine}\n` +
        `const props = defineProps<${ir.name}Props${generics}>();`
      );
    }
    return (
      `${interfaceLine}\n` +
      `const props = withDefaults(\n` +
      `  defineProps<${ir.name}Props${generics}>(),\n` +
      `  { ${defaultsEntries.join(', ')} }\n` +
      `);`
    );
  }

  // Non-generic mode (existing Phase 3 shape — byte-identical for the 5
  // reference examples that never set genericParams).
  if (defaultsEntries.length === 0) {
    return `const props = defineProps<{ ${fields.join('; ')} }>();`;
  }

  return (
    `const props = withDefaults(\n` +
    `  defineProps<{ ${fields.join('; ')} }>(),\n` +
    `  { ${defaultsEntries.join(', ')} }\n` +
    `);`
  );
}

/**
 * Emit one `const X = defineModel<T>('X', { default: ... })` per model prop.
 * Per Pitfall 3: model props are EXCLUDED from defineProps.
 */
function emitDefineModels(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const p of ir.props) {
    if (!p.isModel) continue;
    const tsType = renderType(p.typeAnnotation);
    if (p.defaultValue !== null) {
      const dflt = genCode(p.defaultValue);
      lines.push(
        `const ${p.name} = defineModel<${tsType}>('${p.name}', { default: ${dflt} });`,
      );
    } else {
      lines.push(`const ${p.name} = defineModel<${tsType}>('${p.name}');`);
    }
  }
  return lines;
}

/**
 * Emit `const emit = defineEmits<{ event: [...args: any[]]; ... }>()` if
 * ir.emits is non-empty. v1: emit args typed as `[...args: any[]]` since IR
 * doesn't carry per-emit arg types (TYPES-01 lands in Phase 6).
 */
function emitDefineEmitsCall(ir: IRComponent): string {
  if (ir.emits.length === 0) return '';
  const lines = ir.emits.map((e) => `  ${e}: [...args: any[]];`).join('\n');
  return `const emit = defineEmits<{\n${lines}\n}>();`;
}

/**
 * Emit `defineSlots<...>()` if ir.slots is non-empty. Plan 03 refines from the
 * Plan 02 `props: any` stub to per-param `{ paramName: any; ... }` literals via
 * `buildSlotTypeBlock` (refineSlotTypes.ts). Param value types remain `any` for
 * v1 — TYPES-01 in Phase 6 will refine when the type-flow pass lands.
 */
function emitDefineSlotsStub(ir: IRComponent): string {
  if (ir.slots.length === 0) return '';
  const lines = buildSlotTypeBlock(ir.slots);
  return `defineSlots<{\n${lines}\n}>();`;
}

/**
 * Emit `const X = ref(initializer)` per StateDecl (D-32).
 */
function emitDataRefs(ir: IRComponent, imports: VueImportCollector): string[] {
  const lines: string[] = [];
  for (const s of ir.state) {
    imports.use('ref');
    lines.push(`const ${s.name} = ref(${genCode(s.initializer)});`);
  }
  return lines;
}

/**
 * Emit `const Xref = ref<TagType>()` per RefDecl. Per Pitfall 4 the variable
 * name has a `Ref` suffix to avoid collisions with <data>/<computed>/<props>
 * declarations of the same name.
 *
 * Element-tag → DOM type guess:
 *   - 'input' / 'textarea' / 'select' → corresponding HTML*Element
 *   - everything else → HTMLElement
 *
 * v1 acceptable simplification — Phase 6 TYPES-01 may refine.
 */
function emitTemplateRefs(ir: IRComponent, imports: VueImportCollector): string[] {
  const lines: string[] = [];
  for (const r of ir.refs) {
    imports.use('ref');
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
    }
    lines.push(`const ${r.name}Ref = ref<${domType}>();`);
  }
  return lines;
}

/**
 * Emit `const X = computed(() => body)` per ComputedDecl (D-34).
 *
 * Body comes from `c.body` which is either an Expression or a BlockStatement.
 * For Expression bodies → `() => expression`.
 * For BlockStatement bodies → `() => { stmts; }`.
 *
 * Per IR-01: computed entries' `body` fields point to the SAME nodes referenced
 * from ir.setupBody.scriptProgram (referential equality with original tree).
 * To pick up our identifier rewrites, we must use the CLONED versions.
 */
function emitComputedDecls(
  computedDecls: ComputedDecl[],
  cloneClonedComputedBodies: Map<string, t.Expression | t.BlockStatement>,
  imports: VueImportCollector,
): string[] {
  const lines: string[] = [];
  for (const c of computedDecls) {
    imports.use('computed');
    const body = cloneClonedComputedBodies.get(c.name) ?? c.body;
    // Per D-34: wrap the rewritten body in `computed(() => ...)` so the emitted
    // decl is a Vue Ref<T>. Read-side `.value` access is appended by
    // rewriteRozieIdentifiers' Identifier visitor in templates / scripts.
    // genCode handles both BlockStatement (`{ return x; }`) and Expression (`x`)
    // bodies correctly — the if/else was dead code (both branches identical).
    lines.push(`const ${c.name} = computed(() => ${genCode(body)});`);
  }
  return lines;
}

/**
 * Walk the cloned program's top-level body and locate, for each ComputedDecl
 * by name, the corresponding initializer expression in the clone (post-rewrite).
 *
 * The clone preserves source-order indices, so we walk and match VariableDeclarator
 * id.name === computed.name where the initializer is a CallExpression to $computed
 * (the arrow's body is the body we want).
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
      if (!t.isIdentifier(d.init.callee) || d.init.callee.name !== '$computed') continue;
      const cb = d.init.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        out.set(d.id.name, cb.body);
      }
    }
  }
  return out;
}

/**
 * Emit lifecycle hook calls. Walks the CLONED program (so rewrites are picked
 * up in setup/cleanup bodies) and pairs adjacent $onMount/$onUnmount Identifier
 * pairs per Phase 2 D-19 / RESEARCH.md Pattern 4 / Pitfall 10.
 *
 * Pitfall 5 cross-scope cleanup pattern fires when an arrow $onMount returns a
 * cleanup function — the cleanup is hoisted via `let _cleanup_N` indirection
 * so the cleanup callback can capture vars from the mount-time scope.
 *
 * @returns lifecycle code lines + the SET of indices CONSUMED in clonedProgram.body
 *          (so emitResidualScriptBody can skip them).
 */
function emitLifecycleHooks(
  clonedProgram: t.File,
  imports: VueImportCollector,
): { lines: string[]; consumedIndices: Set<number> } {
  const lines: string[] = [];
  const consumed = new Set<number>();
  let cleanupCounter = 0;

  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    if (consumed.has(i)) continue;
    const stmt = body[i];
    if (!stmt || !t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) continue;
    const calleeName = expr.callee.name;
    if (
      calleeName !== '$onMount' &&
      calleeName !== '$onUnmount' &&
      calleeName !== '$onUpdate'
    ) {
      continue;
    }

    const arg = expr.arguments[0];
    if (!arg) continue;
    consumed.add(i);

    if (calleeName === '$onUpdate') {
      imports.use('onUpdated');
      // Setup-only hook for update phase.
      lines.push(`onUpdated(${genCode(arg as t.Node)});`);
      continue;
    }

    if (calleeName === '$onUnmount') {
      // Standalone unmount (no preceding mount paired earlier).
      imports.use('onBeforeUnmount');
      lines.push(`onBeforeUnmount(${genCode(arg as t.Node)});`);
      continue;
    }

    // calleeName === '$onMount' — emit onMounted; check for paired $onUnmount
    // OR for an inline cleanup-return inside an arrow callback (Pitfall 5).
    imports.use('onMounted');

    if (t.isIdentifier(arg)) {
      // Identifier-pair case (Modal lockScroll/unlockScroll).
      // Peek next non-consumed ExpressionStatement — if it's $onUnmount(Identifier)
      // adjacent in source order, pair them: emit `onMounted(setup); onBeforeUnmount(cleanup);`
      let pairedIdx: number | null = null;
      for (let j = i + 1; j < body.length; j++) {
        if (consumed.has(j)) continue;
        const next = body[j];
        if (!next) continue;
        // Skip pure-helper-decl statements? No — adjacency is at lifecycle level.
        // We only pair if the very next ExpressionStatement is $onUnmount(Identifier).
        if (!t.isExpressionStatement(next)) {
          // Not an expression — break (adjacency rule).
          // But Phase 2 pairs only when truly adjacent at the source-call level.
          // Leave conservative: do NOT skip helper decls; require strict adjacency.
          break;
        }
        const nextExpr = next.expression;
        if (
          t.isCallExpression(nextExpr) &&
          t.isIdentifier(nextExpr.callee) &&
          nextExpr.callee.name === '$onUnmount'
        ) {
          const cleanupArg = nextExpr.arguments[0];
          if (cleanupArg && t.isIdentifier(cleanupArg)) {
            pairedIdx = j;
          }
        }
        break;
      }

      if (pairedIdx !== null) {
        consumed.add(pairedIdx);
        const pairedStmt = body[pairedIdx]!;
        if (t.isExpressionStatement(pairedStmt) && t.isCallExpression(pairedStmt.expression)) {
          const cleanupArg = pairedStmt.expression.arguments[0]!;
          imports.use('onBeforeUnmount');
          lines.push(`onMounted(${genCode(arg as t.Node)});`);
          lines.push(`onBeforeUnmount(${genCode(cleanupArg as t.Node)});`);
          continue;
        }
      }

      // No paired unmount — just onMounted(identifier).
      lines.push(`onMounted(${genCode(arg as t.Node)});`);
      continue;
    }

    // arg is an arrow/function — check for inline cleanup-return (Pitfall 5).
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      const fnBody = arg.body;
      // Cleanup-return: BlockStatement whose last statement is `return <expr>;`
      let cleanupExpr: t.Expression | null = null;
      let setupBody: t.BlockStatement | t.Expression = fnBody;
      let async = false;
      if (arg.async) async = true;

      if (t.isBlockStatement(fnBody) && !async) {
        const lastStmt = fnBody.body[fnBody.body.length - 1];
        if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
          cleanupExpr = lastStmt.argument;
          // Strip the return statement from the setup body for emission.
          setupBody = t.blockStatement(fnBody.body.slice(0, -1));
        }
      }

      if (cleanupExpr) {
        // Pitfall 5: cross-scope-cleanup pattern.
        const N = cleanupCounter++;
        imports.use('onBeforeUnmount');

        // Render setup body as `() => { ...; _cleanup_N = <cleanupExpr>; }`.
        // Strategy: prepend assignment of the cleanup to _cleanup_N inside the setup body.
        const setupBlock = t.isBlockStatement(setupBody) ? setupBody : t.blockStatement([t.expressionStatement(setupBody)]);
        // Append assignment to _cleanup_N.
        const assign = t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.identifier(`_cleanup_${N}`),
            cleanupExpr,
          ),
        );
        const newBlock = t.blockStatement([...setupBlock.body, assign]);

        lines.push(`let _cleanup_${N}: (() => void) | undefined;`);
        lines.push(`onMounted(() => ${genCode(newBlock)});`);
        lines.push(`onBeforeUnmount(() => { _cleanup_${N}?.(); });`);
        continue;
      }

      // No cleanup — emit onMounted(setupExpr).
      lines.push(`onMounted(${genCode(arg as t.Node)});`);
      continue;
    }

    // Fallback: emit verbatim (e.g., a CallExpression returning a fn).
    lines.push(`onMounted(${genCode(arg as t.Node)});`);
  }

  return { lines, consumedIndices: consumed };
}

/**
 * Collect residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitComputedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
 *
 * Per CONTEXT D-30: this preserves console.log + helper function declarations
 * + plain const/let in source order.
 *
 * Returns both the joined code string AND the raw statement array so the
 * caller can generate a single-program source map via GEN_OPTS_MAP.
 */
function emitResidualScriptBody(
  clonedProgram: t.File,
  consumedLifecycleIndices: Set<number>,
): { code: string; stmts: t.Statement[] } {
  const stmts: t.Statement[] = [];
  const body = clonedProgram.program.body;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    if (!stmt) continue;
    if (consumedLifecycleIndices.has(i)) continue;

    // Skip VariableDeclarations whose declarators are ALL $computed initializers.
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
    }

    // Skip ExpressionStatements that are $emit/$computed/$onMount/$onUnmount/$onUpdate
    // calls at top level — these would only get here if not consumed above (rare/safety).
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (t.isIdentifier(callee)) {
        if (
          callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate'
        ) {
          continue;
        }
      }
    }

    stmts.push(stmt);
  }

  const code = stmts.map((s) => genCode(s)).join('\n');
  return { code, stmts };
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptOptions {
  /**
   * D-85 Vue full (Plan 06-02 Task 3): when set, emitPropsDecl emits a
   * parameterized interface `${Name}Props<T, ...>` so that the surrounding
   * `<script setup generic="T">` attribute (set by buildShell) can resolve
   * the type parameter through the `defineProps<...>` macro.
   *
   * When omitted (the existing Phase 3 calling pattern), the existing
   * inline type literal is emitted unchanged — byte-identical for the 5
   * non-generic reference examples.
   */
  genericParams?: string[];
  /**
   * Phase 06.1 P2 (D-103): .rozie filename surfaced as `sourceFileName` on
   * @babel/generator's per-call output map. Defaults to '<rozie>' when
   * omitted (mostly back-compat for tests; production callers thread the
   * real filename through).
   */
  filename?: string;
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptResult {
  script: string;
  /**
   * Source map for user-authored statements (residual body), produced by
   * @babel/generator with sourceMaps:true via a single-program generate call.
   * Maps positions in the generated residual text back to the original .rozie
   * source lines. The shell adjusts this map's generated line numbers by
   * userCodeLineOffset so the final map references the correct .vue output
   * line numbers. Null when there are no residual statements or no filename
   * was provided.
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Number of lines in all sections assembled BEFORE the residual (user-code)
   * section. Used by buildShell to compute userCodeLineOffset — the total
   * number of output lines before the user-authored statements begin.
   */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  rewriteRozieIdentifiers(cloned, ir, diagnostics);

  const imports = new VueImportCollector();

  // 3. Emit blocks in canonical order.
  const propsLine = emitPropsDecl(ir, opts.genericParams);
  const modelLines = emitDefineModels(ir);
  const emitsLine = emitDefineEmitsCall(ir);
  const slotsLine = emitDefineSlotsStub(ir);
  const dataLines = emitDataRefs(ir, imports);
  const refLines = emitTemplateRefs(ir, imports);

  const clonedComputedBodies = findClonedComputedBodies(cloned);
  const computedLines = emitComputedDecls(ir.computed, clonedComputedBodies, imports);

  const { lines: lifecycleLines, consumedIndices } = emitLifecycleHooks(cloned, imports);

  const { code: residualCode, stmts: residualStmts } = emitResidualScriptBody(cloned, consumedIndices);

  // 4. Assemble in canonical order with blank-line separators between sections.
  const preambleSections: string[] = [];
  const importLine = imports.render();
  if (importLine) preambleSections.push(importLine);
  if (propsLine) preambleSections.push(propsLine);
  if (modelLines.length > 0) preambleSections.push(modelLines.join('\n'));
  if (emitsLine) preambleSections.push(emitsLine);
  if (slotsLine) preambleSections.push(slotsLine);
  if (dataLines.length > 0) preambleSections.push(dataLines.join('\n'));
  if (refLines.length > 0) preambleSections.push(refLines.join('\n'));
  if (computedLines.length > 0) preambleSections.push(computedLines.join('\n'));

  // Count lines in preamble sections so shell can compute userCodeLineOffset.
  // Each section is joined with '\n\n' between sections; count newlines total.
  // When there IS a residual section, `script = preambleText + '\n\n' + residualCode`.
  // The '\n\n' separator contributes 2 newlines:
  //   - 1st '\n' terminates the last preamble line
  //   - 2nd '\n' creates a blank separator line
  // So lines before residual = (newlines_in_preambleText + 1 lines) + 1 blank = N + 2.
  const preambleText = preambleSections.join('\n\n');
  const preambleSectionLines = preambleText.length > 0
    ? (preambleText.match(/\n/g) ?? []).length + 2  // +2: last preamble line + blank separator
    : 0;

  // Residual body BEFORE lifecycle hooks — `onMounted(lockScroll)` references
  // `lockScroll` which is a `const` declared in the residual body. Emitting
  // lifecycle BEFORE residual triggered a JS TDZ crash at component mount
  // time (Modal.rozie repro). Vue's onMounted just registers the callback;
  // it doesn't matter whether it's called before or after a `const` decl as
  // long as the const exists by the time `onMounted`'s argument is evaluated.
  const sections = [...preambleSections];
  if (residualCode.trim().length > 0) sections.push(residualCode);
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));

  const script = sections.join('\n\n');

  // Generate a single-program source map for the residual (user-authored) statements.
  // These AST nodes carry correct .rozie line numbers from @babel/parser, so the
  // map produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the final
  // map references the correct .vue output line numbers.
  let scriptMap: EncodedSourceMap | null = null;
  if (residualStmts.length > 0 && opts.filename) {
    const genResult = generate(
      t.file(t.program(residualStmts)),
      { ...GEN_OPTS_MAP, sourceFileName: opts.filename },
    );
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  return { script, scriptMap, preambleSectionLines, diagnostics };
}

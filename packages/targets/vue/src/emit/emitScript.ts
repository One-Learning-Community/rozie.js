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
 *   9. onMounted/onBeforeUnmount/onUpdated calls  (D-33 + Pitfall 5/10)
 *  10. residual script body                       (helper-fn, plain-decl, console.log)
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

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

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
 */
function emitPropsDecl(ir: IRComponent): string {
  const nonModel = ir.props.filter((p) => !p.isModel);
  if (nonModel.length === 0) return '';

  const fields = nonModel.map((p) => `${p.name}?: ${renderType(p.typeAnnotation)}`);

  // Build the defaults object — only include props with non-null defaultValue.
  const defaultsEntries: string[] = [];
  for (const p of nonModel) {
    if (p.defaultValue !== null) {
      defaultsEntries.push(`${p.name}: ${genCode(p.defaultValue)}`);
    }
  }

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
 * Emit `defineSlots<...>()` if ir.slots is non-empty. v1 uses `props: any` for
 * the param type — Plan 03 (P2) refines to actual scoped-slot types when slot
 * params land.
 */
function emitDefineSlotsStub(ir: IRComponent): string {
  if (ir.slots.length === 0) return '';
  const lines = ir.slots
    .map((s) => {
      const name = s.name === '' ? 'default' : s.name;
      return `  ${name}(props: any): any;`;
    })
    .join('\n');
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
    let bodyCode: string;
    if (t.isBlockStatement(body)) {
      bodyCode = `() => ${genCode(body)}`;
    } else {
      bodyCode = `() => ${genCode(body)}`;
    }
    lines.push(`const ${c.name} = ${bodyCode};`);
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
 * Emit residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitComputedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
 *
 * Per CONTEXT D-30: this preserves console.log + helper function declarations
 * + plain const/let in source order.
 */
function emitResidualScriptBody(
  clonedProgram: t.File,
  consumedLifecycleIndices: Set<number>,
): string {
  const out: string[] = [];
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

    out.push(genCode(stmt));
  }

  return out.join('\n');
}

/**
 * @experimental — shape may change before v1.0
 */
export interface EmitScriptResult {
  script: string;
  diagnostics: Diagnostic[];
}

export function emitScript(ir: IRComponent): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  rewriteRozieIdentifiers(cloned, ir, diagnostics);

  const imports = new VueImportCollector();

  // 3. Emit blocks in canonical order.
  const propsLine = emitPropsDecl(ir);
  const modelLines = emitDefineModels(ir);
  const emitsLine = emitDefineEmitsCall(ir);
  const slotsLine = emitDefineSlotsStub(ir);
  const dataLines = emitDataRefs(ir, imports);
  const refLines = emitTemplateRefs(ir, imports);

  const clonedComputedBodies = findClonedComputedBodies(cloned);
  const computedLines = emitComputedDecls(ir.computed, clonedComputedBodies, imports);

  const { lines: lifecycleLines, consumedIndices } = emitLifecycleHooks(cloned, imports);

  const residual = emitResidualScriptBody(cloned, consumedIndices);

  // 4. Assemble in canonical order with blank-line separators between sections.
  const sections: string[] = [];
  const importLine = imports.render();
  if (importLine) sections.push(importLine);
  if (propsLine) sections.push(propsLine);
  if (modelLines.length > 0) sections.push(modelLines.join('\n'));
  if (emitsLine) sections.push(emitsLine);
  if (slotsLine) sections.push(slotsLine);
  if (dataLines.length > 0) sections.push(dataLines.join('\n'));
  if (refLines.length > 0) sections.push(refLines.join('\n'));
  if (computedLines.length > 0) sections.push(computedLines.join('\n'));
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));
  if (residual.trim().length > 0) sections.push(residual);

  const script = sections.join('\n\n');

  return { script, diagnostics };
}

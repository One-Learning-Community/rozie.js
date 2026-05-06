/**
 * emitScript — Phase 5 Plan 02a Task 1.
 *
 * Produces the body of `<script lang="ts">` for a Svelte 5+ SFC. Output
 * order (per RESEARCH.md Pattern 1 + Plan §<action>):
 *
 *   1. import type { Snippet } from 'svelte';        (only if slots present)
 *   2. interface Props { ... }                       (only if props OR slots present)
 *   3. let { ... }: Props = $props();                (only if props OR slots present)
 *   4. let dataX = $state(initializer);              (per StateDecl)
 *   5. let refX = $state<HTMLElement>();             (per RefDecl — bare let, bind:this in template)
 *   6. residual <script> body (verbatim @babel/generator output)
 *   7. const computedX = $derived(expr);             (per ComputedDecl)
 *   8. $effect(() => { setup; return cleanup; });    (per LifecycleHook — D-19 paired)
 *   9. $effect listener blocks                       (appended by emitListeners — Task 3)
 *
 * Residual-before-derived/effect mirrors Vue: keeps user-authored helper
 * functions and `console.log` close to the top of the script and lets
 * `$derived`/`$effect` references resolve naturally because `const`
 * declarations from the residual body are in scope.
 *
 * Per RESEARCH Pitfall 7: array re-assignments (`items = [...items, x]`) are
 * preserved verbatim — Svelte's `$state` re-runs effects on re-assignment.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-svelte` imports —
 * debounce / throttle / outsideClick all inline in v1.
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
  RefDecl,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { collectSvelteImports } from '../rewrite/collectSvelteImports.js';
import { buildSlotTypeFields } from './refineSlotTypes.js';

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
 * SvelteScriptInjection — opaque token type that Tasks 2/3 append to. Mirrors
 * Vue's ScriptInjection — emitTemplate (Task 2) may add inline-debounce IIFEs
 * for template @event modifiers, emitListeners (Task 3) may add throttle
 * wrapper IIFEs. Plan 02a v1 emits ZERO injections from emitScript itself.
 *
 * Each injection has:
 *   - `decl`: a script-level `const X = (() => { ... })();` style declaration
 *   - `position`: where to splice it ('top' = before residual body, 'bottom' =
 *      after residual body, used for handlers that reference user-declared
 *      consts which would TDZ if hoisted)
 */
export interface SvelteScriptInjection {
  /** Stable name for the injected helper (used by callers to reference it). */
  name: string;
  /** Full declaration text (including trailing semicolon). */
  decl: string;
  /** Splice position relative to the residual <script> body. */
  position: 'top' | 'bottom';
}

/**
 * Render a PropTypeAnnotation as a TypeScript type string. Mirrors the Vue
 * target's renderType helper.
 */
function renderType(type: PropTypeAnnotation): string {
  if (type.kind === 'identifier') {
    switch (type.name) {
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
        return type.name;
    }
  }
  if (type.kind === 'union') {
    return type.members.map(renderType).join(' | ');
  }
  if (type.kind === 'literal') {
    if (type.value === 'array') return 'unknown[]';
    if (type.value === 'object') return 'unknown';
    if (type.value === 'function') return '(...args: any[]) => any';
    return type.value;
  }
  return 'unknown';
}

/**
 * Build the `interface Props { ... }` body fields. Returns a list of indented
 * lines suitable for splicing inside `interface Props {\n${...}\n}`.
 *
 * Includes BOTH props and slots (per RESEARCH Pattern 1 + Pattern 3 — slots
 * are properties of the same Props type).
 */
function buildPropsInterfaceFields(ir: IRComponent): string[] {
  const lines: string[] = [];

  for (const p of ir.props) {
    lines.push(`  ${p.name}?: ${renderType(p.typeAnnotation)};`);
  }

  // Slot fields share the Props interface — Snippet<[...]> typed.
  const slotLines = buildSlotTypeFields(ir.slots);
  for (const sl of slotLines) lines.push(sl);

  // Emit callback-prop declarations: $emit('search', x) was rewritten to
  // onsearch?.(x) by rewriteScript; the corresponding `onsearch?` prop must
  // be declared and destructured. Svelte 5 callback-prop convention is
  // ALL-LOWERCASE (e.g., `onclose`, `onsearch`) — NOT React's PascalCase
  // `onSearch`. v1 types args as `(...args: unknown[]) => void` since IR
  // doesn't carry per-emit arg types (Phase 6 TYPES-01 refines).
  for (const e of ir.emits) {
    const onName = `on${e.toLowerCase()}`;
    lines.push(`  ${onName}?: (...args: unknown[]) => void;`);
  }

  return lines;
}

/**
 * Render the destructuring entries inside `let { ... }: Props = $props();`.
 *
 * Each prop becomes `name = defaultValue` or `name = $bindable(defaultValue)`
 * for `model: true`. Slot props (children + named) appear as bare names —
 * Svelte assigns the snippet to the destructured local; no default value.
 *
 * Per Pitfall 11: `$bindable()` props need an explicit `$bindable(...)` rune;
 * snippet props are immutable (we never emit reassignment to them).
 */
function buildPropsDestructureEntries(ir: IRComponent): string[] {
  const entries: string[] = [];

  for (const p of ir.props) {
    const dflt = p.defaultValue !== null ? genCode(p.defaultValue) : null;
    if (p.isModel) {
      // model: true → $bindable(default) wrapper. With NO default → $bindable().
      const inner = dflt !== null ? dflt : '';
      entries.push(`${p.name} = $bindable(${inner})`);
    } else if (dflt !== null) {
      entries.push(`${p.name} = ${dflt}`);
    } else {
      // No default — bare destructure (Svelte will leave undefined).
      entries.push(p.name);
    }
  }

  // Slot prop destructures — bare names. Default slot keys as 'children'.
  for (const s of ir.slots) {
    const key = s.name === '' ? 'children' : s.name;
    entries.push(key);
  }

  // Emits → bare destructure of the all-lowercase callback prop. Matches
  // the rewriteScript output (`onsearch?.(x)`).
  for (const e of ir.emits) {
    entries.push(`on${e.toLowerCase()}`);
  }

  return entries;
}

/**
 * Emit the Props interface + destructure block. Returns an empty string when
 * there are no props AND no slots.
 */
function emitPropsBlock(ir: IRComponent): string {
  if (ir.props.length === 0 && ir.slots.length === 0 && ir.emits.length === 0) return '';

  const fields = buildPropsInterfaceFields(ir);
  const entries = buildPropsDestructureEntries(ir);

  const interfaceBlock = `interface Props {\n${fields.join('\n')}\n}`;

  // Multi-line destructure for readability when more than 2 entries.
  let destructure: string;
  if (entries.length <= 2) {
    destructure = `let { ${entries.join(', ')} }: Props = $props();`;
  } else {
    destructure = `let {\n  ${entries.join(',\n  ')},\n}: Props = $props();`;
  }

  return `${interfaceBlock}\n\n${destructure}`;
}

/**
 * Emit `let foo = $state(initializer);` per StateDecl.
 */
function emitStateDecls(ir: IRComponent): string[] {
  const lines: string[] = [];
  for (const s of ir.state) {
    lines.push(`let ${s.name} = $state(${genCode(s.initializer)});`);
  }
  return lines;
}

/**
 * Emit `let foo = $state<DomType>();` per RefDecl.
 *
 * Element-tag → DOM type guess; mirrors Vue's emitTemplateRefs helper.
 * In Svelte 5 refs are bare let bindings; the template's `bind:this={foo}`
 * directive populates them. They MUST be `$state(...)` to be reactive when
 * read inside `$derived` / `$effect` blocks.
 */
function emitRefDecls(refs: RefDecl[]): string[] {
  const lines: string[] = [];
  for (const r of refs) {
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
    lines.push(`let ${r.name} = $state<${domType} | undefined>(undefined);`);
  }
  return lines;
}

/**
 * Walk the cloned program and locate, for each ComputedDecl by name, the
 * corresponding initializer expression in the clone (post-rewrite).
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
 * Emit `const X = $derived(expr);` per ComputedDecl. Block-bodied computed
 * functions get `$derived.by(() => { ... })` per RESEARCH Pattern 1.
 */
function emitDerivedDecls(
  computedDecls: ComputedDecl[],
  clonedComputedBodies: Map<string, t.Expression | t.BlockStatement>,
): string[] {
  const lines: string[] = [];
  for (const c of computedDecls) {
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    if (t.isBlockStatement(body)) {
      lines.push(`const ${c.name} = $derived.by(() => ${genCode(body)});`);
    } else {
      lines.push(`const ${c.name} = $derived(${genCode(body)});`);
    }
  }
  return lines;
}

/**
 * Walk lifecycle hooks (D-19 paired) and emit one `$effect(() => { ... })`
 * block per hook. Returns lifecycle code lines + the SET of indices CONSUMED
 * in clonedProgram.body (so emitResidualScriptBody can skip them).
 *
 * Pairing rules per D-19 + Pitfall 4:
 *   - $onMount(setup) + $onUnmount(cleanup) ADJACENT identifier pair →
 *     ONE `$effect(() => { setup(); return cleanup; });`
 *   - $onMount(arrow with cleanup-return) → preserve verbatim — `$effect(() => {
 *     setup; return cleanup; });`
 *   - $onMount alone (no cleanup) → `$effect(() => { setup; });`
 *   - $onUnmount alone → `$effect(() => () => { cleanup; });` (return-only effect)
 *   - $onUpdate → `$effect(() => { body });` (auto-tracks reactive reads)
 *
 * D-19 Modal repro: `$onMount(lockScroll); $onUnmount(unlockScroll);` adjacent
 * pair MUST emit as ONE $effect block, not split.
 */
function emitLifecycleHooks(
  clonedProgram: t.File,
): { lines: string[]; consumedIndices: Set<number> } {
  const lines: string[] = [];
  const consumed = new Set<number>();

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
      // Update phase: re-run on every reactive change. Svelte's $effect
      // auto-tracks signal reads — a plain $effect(setup) IS update phase.
      lines.push(`$effect(() => (${genCode(arg as t.Node)})());`);
      continue;
    }

    if (calleeName === '$onUnmount') {
      // Standalone unmount (no preceding mount paired earlier).
      // Svelte 5 idiom: `$effect(() => () => { cleanup() })` — the outer
      // arrow returns the cleanup arrow on first run.
      lines.push(`$effect(() => () => (${genCode(arg as t.Node)})());`);
      continue;
    }

    // calleeName === '$onMount' — emit $effect; check for paired $onUnmount
    // OR for an inline cleanup-return inside an arrow callback.

    if (t.isIdentifier(arg)) {
      // Identifier-pair case (Modal lockScroll/unlockScroll).
      let pairedIdx: number | null = null;
      let pairedCleanupName: string | null = null;
      for (let j = i + 1; j < body.length; j++) {
        if (consumed.has(j)) continue;
        const next = body[j];
        if (!next) continue;
        if (!t.isExpressionStatement(next)) break;
        const nextExpr = next.expression;
        if (
          t.isCallExpression(nextExpr) &&
          t.isIdentifier(nextExpr.callee) &&
          nextExpr.callee.name === '$onUnmount'
        ) {
          const cleanupArg = nextExpr.arguments[0];
          if (cleanupArg && t.isIdentifier(cleanupArg)) {
            pairedIdx = j;
            pairedCleanupName = cleanupArg.name;
          }
        }
        break;
      }

      if (pairedIdx !== null && pairedCleanupName !== null) {
        consumed.add(pairedIdx);
        // Modal D-19 anchor: ONE $effect block per pair.
        lines.push(
          `$effect(() => {\n  ${arg.name}();\n  return () => ${pairedCleanupName}();\n});`,
        );
        continue;
      }

      // No paired unmount — bare `$effect(() => identifier())`.
      lines.push(`$effect(() => { ${arg.name}(); });`);
      continue;
    }

    // arg is an arrow/function — check for inline cleanup-return.
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      const fnBody = arg.body;
      let cleanupExpr: t.Expression | null = null;
      let setupBody: t.BlockStatement | null = null;

      if (t.isBlockStatement(fnBody) && !arg.async) {
        const lastStmt = fnBody.body[fnBody.body.length - 1];
        if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
          cleanupExpr = lastStmt.argument;
          setupBody = t.blockStatement(fnBody.body.slice(0, -1));
        }
      }

      if (cleanupExpr && setupBody) {
        // $effect(() => { setupBody; return cleanupExpr; })
        // Reconstruct: emit the setup statements + a return statement holding
        // the cleanup expression.
        const merged = t.blockStatement([
          ...setupBody.body,
          t.returnStatement(cleanupExpr),
        ]);
        lines.push(`$effect(() => ${genCode(merged)});`);
        continue;
      }

      // No cleanup — invoke the arrow body inline as the effect.
      // Emit as `$effect(() => { ...body... })` for arrow with block body,
      // `$effect(() => expr)` for expression-bodied arrows.
      if (t.isBlockStatement(fnBody)) {
        lines.push(`$effect(() => ${genCode(fnBody)});`);
      } else {
        lines.push(`$effect(() => ${genCode(fnBody)});`);
      }
      continue;
    }

    // Fallback: emit as IIFE.
    lines.push(`$effect(() => (${genCode(arg as t.Node)})());`);
  }

  return { lines, consumedIndices: consumed };
}

/**
 * Emit residual top-level statements in source order — skipping computed
 * VariableDeclarators (handled by emitDerivedDecls) and lifecycle Expression-
 * Statements (handled by emitLifecycleHooks).
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

    // Skip lifecycle ExpressionStatements (defensive; should already be in consumed).
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
  /** The script body (without surrounding `<script lang="ts">` tags). */
  scriptBlock: string;
  /** Pending injections — Plan 02a Task 2/3 append to this. v1 always empty. */
  scriptInjections: SvelteScriptInjection[];
  diagnostics: Diagnostic[];
}

export function emitScript(ir: IRComponent): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: SvelteScriptInjection[] = [];

  // 1. Clone Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Rewrite identifiers on the clone.
  rewriteRozieIdentifiers(cloned, ir, diagnostics);

  // 3. Compute Svelte imports based on IR shape (slots → Snippet).
  const importSet = collectSvelteImports(ir);
  const importLines: string[] = [];
  if (importSet.typeImports.size > 0) {
    const sorted = [...importSet.typeImports].sort();
    importLines.push(`import type { ${sorted.join(', ')} } from 'svelte';`);
  }

  // 4. Emit blocks in canonical order.
  const propsBlock = emitPropsBlock(ir);
  const stateLines = emitStateDecls(ir);
  const refLines = emitRefDecls(ir.refs);

  const clonedComputedBodies = findClonedComputedBodies(cloned);
  const derivedLines = emitDerivedDecls(ir.computed, clonedComputedBodies);

  const { lines: lifecycleLines, consumedIndices } = emitLifecycleHooks(cloned);
  const residual = emitResidualScriptBody(cloned, consumedIndices);

  // 5. Assemble in canonical order with blank-line separators.
  const sections: string[] = [];
  if (importLines.length > 0) sections.push(importLines.join('\n'));
  if (propsBlock) sections.push(propsBlock);
  if (stateLines.length > 0) sections.push(stateLines.join('\n'));
  if (refLines.length > 0) sections.push(refLines.join('\n'));
  // Residual body BEFORE derived/effect — DX-03 trust-erosion: console.log
  // appears near the top of <script>; user-declared consts (e.g., handler
  // arrows) are visible to subsequent $derived / $effect references.
  if (residual.trim().length > 0) sections.push(residual);
  if (derivedLines.length > 0) sections.push(derivedLines.join('\n'));
  if (lifecycleLines.length > 0) sections.push(lifecycleLines.join('\n'));

  const scriptBlock = sections.join('\n\n');

  return { scriptBlock, scriptInjections, diagnostics };
}

/**
 * angularOutputs — the ONE derivation of an Angular component's `output()`
 * fields (name, alias, payload type), shared by the compiled module
 * (`emitScript.ts` §6d) and the `.d.rozie.ts` sidecar (`emitTypes.ts`), so the
 * declared class surface cannot drift from the compiled one (typed-surface P1,
 * final wave M5).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { IRComponent } from '@rozie/core';
import { printTSType } from '@rozie/core';
import { angularOutputBinding } from '../rewrite/sanitizeEventName.js';

/**
 * Bug 4: scan the cloned Program for `$emit('name', ...)` CallExpressions and
 * return the set of event names that are passed a payload argument in at least
 * one call. Events NOT in this set never carry a payload and should be emitted
 * as `output<void>()` (so `.emit()` with no args typechecks).
 *
 * MUST run on the clone BEFORE rewriteRozieIdentifiers — the rewrite turns
 * `$emit('name', x)` into `this.name.emit(x)`, erasing the `$emit` callee.
 */
export function collectEmitsWithPayload(clonedProgram: t.File): Set<string> {
  const withPayload = new Set<string>();
  // Use a lightweight recursive walk — no need for full @babel/traverse here.
  const visit = (node: t.Node | null | undefined): void => {
    if (!node || typeof node !== 'object') return;
    if (t.isCallExpression(node)) {
      const callee = node.callee;
      if (
        t.isIdentifier(callee) &&
        callee.name === '$emit' &&
        node.arguments.length >= 1 &&
        t.isStringLiteral(node.arguments[0]!)
      ) {
        const eventName = (node.arguments[0] as t.StringLiteral).value;
        if (node.arguments.length >= 2) withPayload.add(eventName);
      }
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const c of child) visit(c as t.Node);
      } else {
        visit(child as t.Node);
      }
    }
  };
  visit(clonedProgram.program);
  return withPayload;
}

/**
 * quick 260929-ua4 — sibling of `collectEmitsWithPayload` for the calls that
 * live OUTSIDE `<script>`: every `$emit('name', payload)` in `ir.template` and
 * `ir.listeners`. Same payload rule (Identifier callee `$emit`, StringLiteral
 * first argument, 2+ arguments).
 *
 * The script-only scan was insufficient once template- and listeners-only
 * emits were collected into `ir.emits`: `$emit('ping', 1)` written in a click
 * handler declared `ping = output<void>()`, and the template's `ping.emit(1)`
 * then failed TS2554.
 *
 * MUST run before `emitTemplate` rewrites `$emit(...)` into `name.emit(...)`
 * (`emitAngular.ts` calls `emitScript` first, so the IR template expressions
 * still carry the raw `$emit` callee here).
 *
 * A generic read-only deep walk: it recurses into arrays and plain objects,
 * so it covers every IR node kind (events, bindings, interpolations, slot
 * fillers, r-for, r-if) without enumerating them. IR template nodes reference
 * no foreign IRComponent or Program, so it cannot pick up another component's
 * emits. It assigns nothing (unlike `emitContext.ts`'s `walk`), skips source
 * location and comment keys, and guards against cycles with a WeakSet.
 */
const IR_EMIT_WALK_SKIP_KEYS = new Set([
  'loc',
  'start',
  'end',
  'sourceLoc',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

export function collectTemplateEmitsWithPayload(ir: IRComponent): Set<string> {
  const withPayload = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.type === 'CallExpression') {
      const call = node as unknown as t.CallExpression;
      const first = call.arguments[0];
      if (
        t.isIdentifier(call.callee) &&
        call.callee.name === '$emit' &&
        first !== undefined &&
        t.isStringLiteral(first) &&
        call.arguments.length >= 2
      ) {
        withPayload.add(first.value);
      }
    }
    for (const key of Object.keys(node)) {
      if (IR_EMIT_WALK_SKIP_KEYS.has(key)) continue;
      visit(node[key]);
    }
  };
  visit(ir.template);
  visit(ir.listeners);
  return withPayload;
}

/** One `output()` field of the component class. */
export interface AngularOutputDecl {
  /** Class-field identifier. */
  fieldId: string;
  /** `output({ alias })` value, or `null`. */
  alias: string | null;
  /** The `output<T>` type argument text. */
  outputType: string;
}

/**
 * The component's `output()` fields in `ir.emits` order. When `<emits>` is
 * declared, the authored payload type (or `void`) wins; otherwise the
 * unknown/void arity heuristic over `emitsWithPayload` (script + template
 * `$emit` calls that pass a payload) stays. Kebab/snake names get a sanitized
 * field id plus an alias (`angularOutputBinding`).
 *
 * `emitsWithPayload` defaults to a scan of the IR's (unrewritten) script
 * program and template — what the sidecar needs; the module passes its own
 * pre-rewrite clone scan.
 */
export function angularOutputDecls(
  ir: IRComponent,
  emitsWithPayload: ReadonlySet<string> = new Set([
    ...collectEmitsWithPayload(ir.setupBody.scriptProgram),
    ...collectTemplateEmitsWithPayload(ir),
  ]),
): AngularOutputDecl[] {
  return ir.emits.map((e) => {
    const emitDecl = ir.emitDecls != null ? ir.emitDecls.find((d) => d.name === e) : undefined;
    const outputType =
      ir.emitDecls != null
        ? emitDecl?.payload
          ? printTSType(emitDecl.payload)
          : 'void'
        : emitsWithPayload.has(e)
          ? 'unknown'
          : 'void';
    // Quick task 260811-trz (D-04) — routed through the single
    // `angularOutputBinding` source of truth both this declaration side AND
    // `emitTemplateEvent.ts`'s consumer-side resolution consume.
    const { fieldId, alias } = angularOutputBinding(e);
    return { fieldId, alias, outputType };
  });
}

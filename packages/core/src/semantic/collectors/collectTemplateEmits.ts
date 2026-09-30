/**
 * Collector — `$emit('<name>', …)` calls written in `<template>` or in a
 * `<listeners>` handler (quick 260929-ua4).
 *
 * `collectScriptDecls` only walks the `<script>` program, so before this
 * collector a `$emit` that appeared ONLY in the template or ONLY in a listener
 * never reached `bindings.emits` → `IRComponent.emits`. Every target then
 * lowered the call site without declaring the event: React/Solid had no
 * `on<Event>` prop type, Vue had no `defineEmits` (so `emit` was undefined at
 * click time), Svelte never declared the callback prop (a ReferenceError), and
 * Angular had no `output()` field (an AOT error).
 *
 * Runs AFTER `collectScriptDecls` (see `bindings.ts`), so the Set's insertion
 * order is: script names, then template names in DFS pre-order, then listeners
 * names. A name already emitted from `<script>` keeps its script position.
 *
 * Only a StringLiteral first argument is collected. A missing name, a dynamic
 * name (`$emit(nameVar)`) or a template literal is skipped, mirroring
 * `collectScriptDecls`. The shared walker (`../walkEmitCalls.ts`) is the same
 * one `emitNameValidator` uses, so every name collected here is also checked
 * for ROZ122 / ROZ209.
 *
 * Per D-08 collected-not-thrown: silent and NEVER throws.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import type { RozieAST } from '../../ast/types.js';
import type { BindingsTable } from '../types.js';
import { forEachTemplateAndListenersEmitCall } from '../walkEmitCalls.js';

export function collectTemplateEmits(ast: RozieAST, bindings: BindingsTable): void {
  forEachTemplateAndListenersEmitCall(ast, (call) => {
    const first = call.arguments[0];
    if (first && t.isStringLiteral(first)) bindings.emits.add(first.value);
  });
}

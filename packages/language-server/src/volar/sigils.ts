/**
 * Phase 85 (REQ-V8) — ambient TypeScript declarations for Rozie's magic
 * identifiers, built FROM `@rozie/core`'s `RESERVED_SIGILS` rather than a
 * hand-forked copy (that copy is exactly what caused the drift risk this
 * barrel export closes).
 *
 * `RESERVED_SIGILS` covers the 16 sigils the compiler's semantic validator
 * enforces (`ROZ202`). A further set of call-form sigils are NOT reserved
 * identifiers in that sense — they are lifecycle/callable APIs a `<data>`
 * field name or `r-for` alias could never collide with — but still need an
 * ambient declaration so `<script>`/`<template>` type-checks. Those extra
 * entries are declared verbatim here, unchanged from the proven spike
 * (`sources/018-volar-virtual-ts-rozie/rozie-virtual-code.mjs`'s
 * `AMBIENT_PREAMBLE`).
 *
 * REQ-V9 (unifying this with the second, incomplete sigil list in
 * `reactivity/computeDeps.ts` — `$snapshot`, `$classSelector`) is Plan
 * 85-03's job. This module only closes the barrel-export gap.
 */
import { RESERVED_SIGILS } from '@rozie/core';

/** `$props` and `$data` need a per-file generated type name, not `any`. */
const VALUE_DECLARATIONS: Record<string, string> = {
  $props: 'declare const $props: __RozieProps;',
  $data: 'declare const $data: __RozieData;',
  $el: 'declare const $el: HTMLElement;',
  $refs: 'declare const $refs: Record<string, any>;',
  $slots: 'declare const $slots: Record<string, unknown>;',
  $attrs: 'declare const $attrs: Record<string, unknown>;',
  $listeners: 'declare const $listeners: Record<string, (...a: any[]) => void>;',
  $event: 'declare const $event: any;',
  $model: 'declare const $model: any;',
  $slotted: 'declare const $slotted: any;',
};

/** Call-form (function) sigils. `$emit`/`$expose`/`$provide`/`$inject`/`$clone`/`$restoreFocus` ARE in `RESERVED_SIGILS`; the rest are lifecycle/callable APIs that never collide with an author-chosen identifier and so were never added to that set. */
const CALL_DECLARATIONS: Record<string, string> = {
  $emit: 'declare function $emit(event: string, ...args: any[]): void;',
  $expose: 'declare function $expose(obj: Record<string, unknown>): void;',
  $provide: 'declare function $provide(key: string, value: unknown): void;',
  $inject: 'declare function $inject<T = unknown>(key: string, fallback?: T): T;',
  $clone: 'declare function $clone<T>(v: T): T;',
  $restoreFocus: 'declare function $restoreFocus(): void;',
  // Not in RESERVED_SIGILS — call-form APIs, not shadow-able identifiers.
  $computed: 'declare function $computed<T>(fn: () => T): T;',
  $watch: 'declare function $watch(...args: any[]): void;',
  $onMount: 'declare function $onMount(fn: () => void | (() => void)): void;',
  $onUnmount: 'declare function $onUnmount(fn: () => void): void;',
  $onUpdate: 'declare function $onUpdate(fn: () => void): void;',
  $reconcileAfterDomMutation: 'declare function $reconcileAfterDomMutation(fn: () => void): void;',
};

/** Not in `RESERVED_SIGILS` — declared as a value, not a reserved identifier. */
const EXTRA_VALUE_DECLARATIONS: Record<string, string> = {
  $portals: 'declare const $portals: Record<string, any>;',
};

/**
 * Sigil name -> ambient TypeScript declaration text. Every name in
 * `RESERVED_SIGILS` has an entry here (see `missingSigilDeclarations`), plus
 * the call-form/extra-value sigils that are not reserved identifiers but
 * still need a declaration for the generated virtual code to type-check.
 */
export const SIGIL_DECLARATIONS: Readonly<Record<string, string>> = {
  ...VALUE_DECLARATIONS,
  ...CALL_DECLARATIONS,
  ...EXTRA_VALUE_DECLARATIONS,
};

/**
 * Set difference: names in `RESERVED_SIGILS` (the compiler's authoritative
 * list) that have NO declaration in `SIGIL_DECLARATIONS`. Non-empty means the
 * ambient preamble is missing a declaration for a real reserved sigil — a
 * generator gap, not a compiler one. Should always be empty; this is a
 * standing regression guard, not a runtime code path.
 */
export function missingSigilDeclarations(): Set<string> {
  const missing = new Set<string>();
  for (const name of RESERVED_SIGILS) {
    if (!(name in SIGIL_DECLARATIONS)) missing.add(name);
  }
  return missing;
}

/** Join every declaration into the generated-only preamble text. */
export function buildAmbientPreamble(): string {
  return `${Object.values(SIGIL_DECLARATIONS).join('\n')}\n`;
}

/**
 * shell.ts — Phase 3 Plan 05 Task 2.
 *
 * Composes a Vue 3.4 SFC envelope (`<template>` / `<script setup lang="ts">`
 * / `<style[ scoped]>`) via `magic-string`'s `MagicString.append` per
 * RESEARCH Pattern 1 (D-30 — hybrid skeleton + per-block AST/string body).
 *
 * Returning a `MagicString` (not a plain string) lets `emitVue` later call
 * `ms.generateMap(...)` to thread the source map (Pitfall 2 / DX-01).
 *
 * Block order (D-38): `<style scoped>` first, `<style>` (global / `:root`)
 * second. The trailing `</style>\n\n<style>` boundary between them is the
 * Phase 3 success-criterion-5 anchor.
 *
 * Empty styleScoped: emit no `<style scoped>` block (skip the empty-body
 * scaffolding). Empty styleGlobal: emit no global `<style>` block (the
 * StyleSection had no :root rules).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';

export interface ShellParts {
  /** Body of `<template>...</template>` — already produced by emitTemplate. */
  template: string;
  /** Body of `<script setup lang="ts">...</script>` — emitScript + injections. */
  script: string;
  /** Body of `<style scoped>...</style>` — emitStyle scoped output (may be ''). */
  styleScoped: string;
  /** Body of trailing global `<style>...</style>` (D-38 :root extraction), or null. */
  styleGlobal: string | null;
}

export function buildShell(parts: ShellParts): MagicString {
  const ms = new MagicString('');
  ms.append('<template>\n');
  ms.append(parts.template);
  ms.append('\n</template>\n\n');
  ms.append('<script setup lang="ts">\n');
  ms.append(parts.script);
  ms.append('\n</script>\n');
  if (parts.styleScoped.length > 0) {
    ms.append('\n<style scoped>\n');
    ms.append(parts.styleScoped);
    ms.append('\n</style>\n');
  }
  if (parts.styleGlobal !== null && parts.styleGlobal.length > 0) {
    ms.append('\n<style>\n');
    ms.append(parts.styleGlobal);
    ms.append('\n</style>\n');
  }
  return ms;
}

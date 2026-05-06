/**
 * shell.ts — Phase 5 Plan 02a Task 3.
 *
 * Composes a Svelte 5 SFC envelope via `magic-string`'s `MagicString.append`.
 * Block order: <script lang="ts">...</script> first, top-level markup second
 * (NO `<template>` wrapper — Svelte's "top-level markup" is the bare content
 * between </script> and <style>), then a single <style> block.
 *
 * Empty styleBlock: emit no `<style>` block.
 *
 * Returning a `MagicString` (not a plain string) lets `emitSvelte` later call
 * `composeSourceMap(ms, ...)` to thread the source map (DX-01).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';

export interface ShellParts {
  /** Body of `<script lang="ts">...</script>` — emitScript output + injections. */
  script: string;
  /** Top-level markup (between </script> and <style>) — emitTemplate output. */
  template: string;
  /** Body of the single `<style>...</style>` block — empty string skips block. */
  styleBlock: string;
}

export function buildShell(parts: ShellParts): MagicString {
  const ms = new MagicString('');
  ms.append('<script lang="ts">\n');
  ms.append(parts.script);
  ms.append('\n</script>\n\n');
  ms.append(parts.template);
  ms.append('\n');
  if (parts.styleBlock.length > 0) {
    ms.append('\n<style>\n');
    ms.append(parts.styleBlock);
    ms.append('\n</style>\n');
  }
  return ms;
}

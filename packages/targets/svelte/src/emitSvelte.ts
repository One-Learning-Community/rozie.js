/**
 * emitSvelte — Phase 5 Svelte 5+ SFC emitter (Wave 0 stub).
 *
 * Phase 5 Plan 05-02 fills in real implementation:
 *   - emitScript: $state / $derived / $effect / $bindable runes
 *   - emitTemplate: {#each}/{#if}/{#snippet}/{@render} markup builder
 *   - emitListeners: $effect-based listener wiring with cleanup return
 *   - emitStyle: scoped CSS handling (Svelte's compiler scopes natively)
 *   - shell.ts + composeSourceMap: magic-string envelope per DX-01
 *
 * Wave 0 stub returns an empty <script>+<template>+<style> shell so the
 * snapshot harness can run (RED) before Plan 05-02 turns it green.
 *
 * Public surface (D-67): emitSvelte(ir, opts) → { code, map, diagnostics }.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import type { SourceMap } from 'magic-string';

export interface EmitSvelteOptions {
  /**
   * Absolute or relative path to the .rozie source — when provided alongside
   * `source`, emitSvelte returns a real source map referencing this filename.
   * Plan 05-02 wires the magic-string envelope.
   */
  filename?: string;
  /**
   * Original .rozie source text — required by emitStyle to slice rule bodies
   * by absolute byte offsets, and by composeSourceMap for sourcesContent.
   */
  source?: string;
  /**
   * Optional ModifierRegistry — if absent, emitSvelte constructs a fresh
   * createDefaultRegistry() per call (Plan 05-02 wires this).
   */
  modifierRegistry?: ModifierRegistry;
}

export interface EmitSvelteResult {
  code: string;
  /** Real SourceMap when filename+source provided, otherwise null. */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Phase 5 Plan 05-01 Wave 0 stub — Plan 05-02 fills this in.
 *
 * Returns a placeholder Svelte 5 SFC envelope so the snapshot harness can
 * type-check and execute against a defined surface.
 */
export function emitSvelte(_ir: IRComponent, _opts: EmitSvelteOptions = {}): EmitSvelteResult {
  return {
    code: '<!-- Phase 5 Plan 05-01 Wave 0 stub — Plan 05-02 fills this in. -->\n<script lang="ts"></script>\n',
    map: null,
    diagnostics: [],
  };
}

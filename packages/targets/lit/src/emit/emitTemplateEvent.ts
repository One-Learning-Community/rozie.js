/**
 * emitTemplateEvent — Lit target template-event emission (Plan 06.4-02 Task 1;
 * Plan 07.1-02 registry rewrite).
 *
 * Renders a single template `@event` listener as a Lit `@event=${...}` binding.
 * The real per-element walk happens inside emitTemplate.ts; this thin helper
 * is provided for unit-test reach.
 *
 * Modifier classification is registry-driven (Plan 07.1-02): each pipeline
 * entry resolves via `registry.get(entry.modifier).lit(...)` into a
 * `LitEmissionDescriptor`. In template-event context a `native` descriptor is
 * rejected (capture/passive/once option tokens are only meaningful in
 * `<listeners>` blocks) with a ROZ832-class diagnostic; `inlineGuard` codes are
 * prepended into a synthesized arrow handler; `helper` descriptors with
 * `listenerOnly: true` (`.outside`) are likewise rejected.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, Listener } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry, LitEmissionDescriptor } from '@rozie/core';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export interface EmitTemplateEventResult {
  binding: string;
  diagnostics: Diagnostic[];
}

export function emitTemplateEvent(
  listener: Listener,
  ir: IRComponent,
  registry: ModifierRegistry,
): EmitTemplateEventResult {
  const diagnostics: Diagnostic[] = [];
  const handler = rewriteTemplateExpression(listener.handler, ir);
  const guards: string[] = [];

  for (const entry of listener.modifierPipeline) {
    const modifierName =
      entry.kind === 'listenerOption' ? entry.option : entry.modifier;
    const impl = registry.get(modifierName);
    if (!impl || !impl.lit) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' has no Lit emitter (missing lit() hook).`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    const args = entry.kind === 'wrap' || entry.kind === 'filter' ? entry.args : [];
    const descriptor: LitEmissionDescriptor = impl.lit(args, {
      source: 'template-event',
      event: listener.event,
      sourceLoc: entry.sourceLoc,
    });

    if (descriptor.kind === 'native') {
      // capture/passive/once tokens are only valid in <listeners> blocks where
      // they map onto the addEventListener options object.
      diagnostics.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'error',
        message: `Modifier '.${descriptor.token}' has no template-event equivalent in Lit — only valid in <listeners> blocks.`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    if (descriptor.kind === 'inlineGuard') {
      guards.push(descriptor.code);
      continue;
    }
    // descriptor.kind === 'helper'
    if (descriptor.listenerOnly === true) {
      diagnostics.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'error',
        message: `Modifier '.${modifierName}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
        loc: entry.sourceLoc,
      });
      continue;
    }
    // debounce / throttle helper on a template @event — the real per-element
    // walk in emitTemplate.ts hoists these to class fields; this thin helper
    // does not support them, so flag.
    diagnostics.push({
      code: RozieErrorCode.TARGET_LIT_RESERVED,
      severity: 'error',
      message: `Modifier helper '${descriptor.helperName}' on a template @event is handled by emitTemplate, not emitTemplateEvent.`,
      loc: entry.sourceLoc,
    });
  }

  const body =
    guards.length > 0
      ? `(e: Event) => { ${guards.join(' ')} (${handler})(e); }`
      : `(${handler})`;

  return { binding: `@${listener.event}=\${${body}}`, diagnostics };
}

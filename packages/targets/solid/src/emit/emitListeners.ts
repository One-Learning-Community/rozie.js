/**
 * emitListeners — Solid target (P1 minimal).
 *
 * Lowers `<listeners>`-block entries into Solid createEffect blocks.
 * P1 minimum: emit one stub createEffect block per listener entry to prove
 * solidImports.add('createEffect') wiring. Wire
 * runtimeImports.add('createOutsideClick') for any .outside-class listener.
 * P2 emits the correct attach/detach patterns.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';

export interface EmitListenersResult {
  code: string;
  diagnostics: Diagnostic[];
}

export function emitListeners(
  ir: IRComponent,
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _registry: ModifierRegistry,
): EmitListenersResult {
  const diagnostics: Diagnostic[] = [];
  const lines: string[] = [];

  for (const listener of ir.listeners) {
    // Check if this listener has an .outside modifier.
    const hasOutside = listener.modifiers?.some(
      (m) => typeof m === 'object' && 'name' in m && m.name === 'outside',
    ) ?? false;

    if (hasOutside) {
      collectors.runtime.add('createOutsideClick');
      // P1 stub: will be filled in P2 with proper ref/handler resolution.
      lines.push(`// TODO(P2): createOutsideClick for '${listener.event}' listener`);
    } else {
      collectors.solid.add('createEffect');
      // P1 stub: emit a minimal createEffect block.
      lines.push(
        `createEffect(() => {\n` +
        `  // TODO: attach '${listener.event}' listener (P2)\n` +
        `});`,
      );
    }
  }

  return { code: lines.join('\n'), diagnostics };
}

/**
 * emitAngular — Phase 5 Angular 17+ standalone-component emitter (Wave 0 stub).
 *
 * Phase 5 Plan 05-04 fills in real implementation:
 *   - emitScript: signal() / computed() / effect() conversion
 *   - emitTemplate: Angular HTML template string for inline `template:` field
 *     using @if / @for / @switch (Angular 17+ control flow), [(ngModel)] for
 *     model:true props, ng-template + ngTemplateOutlet for slots
 *   - emitListeners: Renderer2.listen + DestroyRef cleanup for <listeners>-block
 *   - emitStyle: scoped CSS via Component({ styles: [...] }) (Angular handles
 *     scoping natively via ViewEncapsulation.Emulated)
 *   - shell.ts + composeSourceMap: magic-string envelope per DX-01
 *
 * Wave 0 stub returns a minimal standalone-component class shell so the
 * snapshot harness can run (RED) before Plan 05-04 turns it green.
 *
 * Public surface (D-67): emitAngular(ir, opts) → { code, map, diagnostics }.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import type { SourceMap } from 'magic-string';

export interface EmitAngularOptions {
  /**
   * Absolute or relative path to the .rozie source — when provided alongside
   * `source`, emitAngular returns a real source map referencing this filename.
   * Plan 05-04 wires the magic-string envelope.
   */
  filename?: string;
  /**
   * Original .rozie source text — required by emitStyle to slice rule bodies
   * by absolute byte offsets, and by composeSourceMap for sourcesContent.
   */
  source?: string;
  /**
   * Optional ModifierRegistry — if absent, emitAngular constructs a fresh
   * createDefaultRegistry() per call (Plan 05-04 wires this).
   */
  modifierRegistry?: ModifierRegistry;
}

export interface EmitAngularResult {
  code: string;
  /** Real SourceMap when filename+source provided, otherwise null. */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

/**
 * Phase 5 Plan 05-01 Wave 0 stub — Plan 05-04 fills this in.
 *
 * Returns a minimal standalone-component class shell so the snapshot harness
 * can type-check and execute against a defined surface.
 */
export function emitAngular(_ir: IRComponent, _opts: EmitAngularOptions = {}): EmitAngularResult {
  return {
    code:
      '// Phase 5 Plan 05-01 Wave 0 stub — Plan 05-04 fills this in.\n' +
      'import { Component } from "@angular/core";\n\n' +
      '@Component({ selector: "rozie-stub", standalone: true, template: "" })\n' +
      'export class Stub {}\n',
    map: null,
    diagnostics: [],
  };
}

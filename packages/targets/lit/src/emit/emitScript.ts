/**
 * emitScript.ts — P1 stub for the Lit target script-section emitter.
 *
 * P2 will produce class fields (signal initializers for `<data>`, `@property`
 * decorators for `<props>`), constructor wiring, lifecycle methods
 * (`connectedCallback` / `disconnectedCallback` / `firstUpdated`), and class
 * methods for top-level functions from the `<script>` block.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { EncodedSourceMap } from '@ampproject/remapping';

export interface EmitScriptResult {
  /** Class field declarations: `@property() foo;`, `_signal = signal(0);` */
  fieldDecls: string;
  /** Constructor body. */
  constructorBody: string;
  /** Class method definitions (lifecycle + user-authored top-level fns). */
  methodDecls: string;
  /** Per-expression child source map for sourcemap composition. */
  scriptMap: EncodedSourceMap | null;
  /** Number of preamble lines so composeSourceMap can offset child segments. */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

export function emitScript(_ir: IRComponent): EmitScriptResult {
  // P1 stub — P2 fills with full class-body emission.
  return {
    fieldDecls: '',
    constructorBody: '',
    methodDecls: '',
    scriptMap: null,
    preambleSectionLines: 0,
    diagnostics: [],
  };
}

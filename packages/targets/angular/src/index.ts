// @rozie/target-angular — Phase 5 Plan 05-01 Wave 0 public surface.
// emitAngular stub coordinator returns a placeholder shell so the snapshot
// harness can run; Plan 05-04 fills in real lowering logic.
export { emitAngular, type EmitAngularOptions, type EmitAngularResult } from './emitAngular.js';
// Phase 22 Plan 22-04 — Angular `.d.rozie.ts` type renderer (declare class +
// typed props). Consumed by the Wave-3 unplugin sidecar dispatch.
export { emitAngularTypes } from './emit/emitTypes.js';
export type { EmitAngularTypesOptions } from './emit/emitTypes.js';

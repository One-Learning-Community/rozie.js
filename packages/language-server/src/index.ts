// @rozie/language-server — the shared semantic brain over LSP.
//
// Built on @rozie/core (Option C): one analyzer, consumed by the VSCode
// extension natively and by the IntelliJ plugin via LSP4IJ. Per-editor layers
// stay thin; semantics live here.

export { computeDiagnostics, toLspDiagnostic } from './diagnostics.js';
export { startServer } from './server.js';

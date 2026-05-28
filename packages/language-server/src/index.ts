// @rozie/language-server — the shared semantic brain over LSP.
//
// Built on @rozie/core (Option C): one analyzer, consumed by the VSCode
// extension natively and by the IntelliJ plugin via LSP4IJ. Per-editor layers
// stay thin; semantics live here.

export { computeDiagnostics, toLspDiagnostic } from './diagnostics.js';
export {
  computeCompletions,
  computeDefinition,
  computeHover,
  computePrepareRename,
  computeReferences,
  computeRename,
} from './features.js';
export { computeDocumentSymbols } from './outline.js';
export { startServer } from './server.js';
export { extractSymbols, symbolsForSigil } from './symbols.js';
export type {
  RozieSymbol,
  RozieSymbols,
  RozieComponentSymbol,
  SigilKind,
} from './symbols.js';
export {
  findSigilMemberUsages,
  resolveSigilMemberAt,
  sigilCompletionContext,
} from './sigil.js';
export type { SigilMemberRef, SigilCompletionContext } from './sigil.js';
export {
  componentTagAt,
  componentTagCompletionContext,
  resolveComponentUri,
  slotFillAt,
  tagAttributeContext,
} from './componentNav.js';
export type {
  ComponentTagHit,
  ComponentTagCompletionContext,
  SlotFillHit,
  TagAttributeContext,
} from './componentNav.js';
export { extractProducerSurface } from './producers.js';
export type { ProducerSurface, ProducerEvent, ProducerSlot } from './producers.js';
export type { FeatureContext } from './features.js';

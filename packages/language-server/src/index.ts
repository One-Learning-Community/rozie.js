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
// Phase 85 Task 3 — the virtual-TypeScript generator, exported so the corpus
// survey (scripts/survey.mjs) can import the SAME production function this
// package's Volar language plugin uses internally, from the built dist
// rather than a forked copy.
export { generateVirtualTs } from './volar/virtualCode.js';
export type { GenerateVirtualTsResult } from './volar/virtualCode.js';
// Phase 85 Plan 02 Task 3 — the full ROZ Volar service-plugin factory,
// alongside the analyzer exports above (which the unit tests consume
// directly and remain a stable surface).
export { createRozieServicePlugins } from './volar/plugins/index.js';

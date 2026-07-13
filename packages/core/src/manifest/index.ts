// Phase 75 Plan 01 — the published-primitive manifest contract barrel.
// buildManifest(ir) (D-03) and parseManifest(json) (D-04) are the two pure
// transforms the resolution wiring (Plan 02) and combobox emission (Plan 03)
// both consume.
// @experimental — shape may change before v1.0
export { buildManifest } from './buildManifest.js';
export { parseManifest } from './readManifest.js';
export type {
  ManifestError,
  ParseManifestOptions,
  ParseManifestResult,
  ProducerSurface,
} from './readManifest.js';
export { MANIFEST_SCHEMA_VERSION } from './schema.js';
export type {
  RozieManifest,
  RozieManifestExposeMember,
  RozieManifestProp,
  RozieManifestSlot,
  RozieManifestSlotParam,
} from './schema.js';

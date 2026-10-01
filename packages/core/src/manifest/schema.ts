/**
 * RozieManifest — the schema-versioned published-primitive manifest contract
 * (Phase 75, D-01/D-02/D-04).
 *
 * A `rozie-manifest.json` ships alongside each per-target compiled leaf of a
 * published `@rozie-ui`-shaped package (e.g. `@rozie-ui/combobox-react`). It
 * carries the FULL child contract a composing family needs without the
 * primitive's `.rozie` source present in the same compile pass: props, slots
 * (with scoped-param types), emits, and the `$expose` handle shape. This
 * unifies and machine-generates what `event-manifest.mjs` / `handle-
 * manifest.mjs` hand-keep today per family (see 75-CONTEXT.md D-01).
 *
 * `buildManifest(ir)` (buildManifest.ts) is the sole producer of this shape —
 * a pure function of `lowerToIR()` output (D-03), never hand-maintained.
 * `parseManifest(json)` (readManifest.ts) is the sole consumer-side reader —
 * it validates `schemaVersion` FIRST and fails closed on any mismatch or
 * malformed input (D-04), never silently degrading.
 *
 * @experimental — shape may change before v1.0
 */
import type { PropDocs } from '../ir/types.js';

/**
 * Current manifest schema version. Bumped whenever RozieManifest's shape
 * changes in a way that would break an older reader — parseManifest rejects
 * any manifest whose `schemaVersion` is not in SUPPORTED_MANIFEST_SCHEMA_VERSIONS (D-04).
 */
export const MANIFEST_SCHEMA_VERSION = 2;

/**
 * Every schema version `parseManifest` can read. v1 (published before the
 * typed public surface: `emits: string[]`, no `tsType`/`signature`/`types`/
 * `paramTypesAuthored`) is still accepted so an installed v1 leaf keeps
 * composing; the writer always emits {@link MANIFEST_SCHEMA_VERSION}.
 */
export const SUPPORTED_MANIFEST_SCHEMA_VERSIONS = [1, 2] as const;

/**
 * One serialized prop entry. `type` is a best-effort informational token (the
 * serialized runtime prop-type, e.g. `"Boolean"`) — `isModel` and `required`
 * are the load-bearing fields consumed by `validateTwoWayBindings`.
 */
export interface RozieManifestProp {
  name: string;
  isModel: boolean;
  required: boolean;
  type: string;
  /**
   * v2 — authored TS type string for the prop; always `null` until phase 2
   * (typed props). Absent in v1 manifests.
   */
  tsType: string | null;
}

/**
 * One serialized slot param — mirrors `ParamDecl.name` (the producer-side
 * slot key threadParamTypes matches against; NOT the consumer's local
 * `bindAs` rename, which is a consumer-side concern).
 */
export interface RozieManifestSlotParam {
  name: string;
}

/**
 * One serialized slot entry. `paramTypes` is `null` when the source
 * `SlotDecl.paramTypes` was undefined; otherwise it is an array of TS type
 * SOURCE STRINGS (one per `SlotDecl.paramTypes[]` entry, `@babel/generator`-
 * serialized) that `parseManifest` re-parses back into real `TSType` nodes so
 * `threadParamTypes` can thread them exactly as it would a local producer.
 */
export interface RozieManifestSlot {
  name: string;
  params: RozieManifestSlotParam[];
  paramTypes: string[] | null;
  isPortal: boolean;
  isReactive: boolean;
  /**
   * v2 — `true` when `paramTypes` came from an authored `:param-types`
   * declaration (printed verbatim, including function types, by consumers).
   * Absent (⇒ false) in v1 manifests.
   */
  paramTypesAuthored: boolean;
}

/** One serialized `$expose` handle member. */
export interface RozieManifestExposeMember {
  name: string;
  /** v2 — authored `$expose` signature (function type source), or `null`. */
  signature: string | null;
}

/** v2 — one serialized `<emits>` entry (v1 was a bare name string). */
export interface RozieManifestEmit {
  name: string;
  /** ONE TS type string, or `null` for a no-argument / undeclared-payload event. */
  payload: string | null;
  docs: PropDocs | null;
}

/**
 * The full published-primitive manifest — the JSON shape written to
 * `rozie-manifest.json` by `buildManifest(ir)` and read back by
 * `parseManifest(json)`.
 */
export interface RozieManifest {
  schemaVersion: number;
  name: string;
  props: RozieManifestProp[];
  slots: RozieManifestSlot[];
  emits: RozieManifestEmit[];
  expose: RozieManifestExposeMember[];
  /** v2 — `renderTypesBlock(ir)` text, or `null` when there is no `<types>`. */
  types: string | null;
}

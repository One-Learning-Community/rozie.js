/**
 * parseManifest(raw) — validate + deserialize a published-primitive manifest
 * into a producer slot/prop/expose surface (Phase 75, D-04).
 *
 * Fails CLOSED on any trust-boundary violation (T-75-01): an unknown or
 * mismatched `schemaVersion` — or any structurally malformed field — never
 * silently degrades into a partial/best-effort surface. Both failure modes
 * return `{ surface: null, error }`; parseManifest NEVER throws (T-75-02: a
 * crafted/oversized paramType source string is dropped per-entry, not fatal).
 *
 * Per T-75-03, every field is read via explicit key access into a FRESH
 * object — parseManifest never `Object.assign`/spreads the parsed JSON into
 * a shared target, so a `__proto__`/`constructor`-keyed manifest cannot
 * pollute anything beyond the literal-keyed surface it produces.
 *
 * @experimental — shape may change before v1.0
 */
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { ParamDecl, PropDecl, SlotDecl } from '../ir/types.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { MANIFEST_SCHEMA_VERSION } from './schema.js';

/** A parseManifest failure — carries the ROZ code (D-04 fail-closed contract). */
export interface ManifestError {
  code: string;
  message: string;
}

/**
 * The producer contract surface `parseManifest` deserializes a manifest
 * into — shaped to satisfy exactly what `threadParamTypes` (slots/props) and
 * `validateTwoWayBindings` (props) read from a producer IR, plus the
 * `$expose` handle shape Phase 66's ref→Handle typing needs.
 */
export interface ProducerSurface {
  slots: SlotDecl[];
  props: Pick<PropDecl, 'name' | 'isModel'>[];
  expose: { name: string }[];
}

export interface ParseManifestOptions {
  /** Informational — surfaced in error messages when provided. */
  packageName?: string;
}

export interface ParseManifestResult {
  surface: ProducerSurface | null;
  error: ManifestError | null;
}

function malformed(message: string): ParseManifestResult {
  return {
    surface: null,
    error: { code: RozieErrorCode.MALFORMED_MANIFEST, message },
  };
}

function schemaMismatch(message: string): ParseManifestResult {
  return {
    surface: null,
    error: { code: RozieErrorCode.MANIFEST_SCHEMA_VERSION_MISMATCH, message },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deserialize one paramType SOURCE STRING back into a `TSType` by parsing
 * `type __RozieParam = <src>;` and lifting the type-alias's typeAnnotation.
 * Wrapped in try/catch — a garbage/oversized string is dropped (returns
 * `null`) rather than throwing out of parseManifest (T-75-02).
 */
function deserializeParamType(src: string): t.TSType | null {
  try {
    const file = babelParse(`type __RozieParam = ${src};`, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    const stmt = file.program.body[0];
    if (!stmt || !t.isTSTypeAliasDeclaration(stmt)) return null;
    return stmt.typeAnnotation;
  } catch {
    return null;
  }
}

/** Validate + rebuild one manifest prop entry. Returns null on structural violation. */
function readProp(raw: unknown): Pick<PropDecl, 'name' | 'isModel'> | null {
  if (!isPlainObject(raw)) return null;
  const name = raw.name;
  const isModel = raw.isModel;
  if (typeof name !== 'string') return null;
  if (typeof isModel !== 'boolean') return null;
  return { name, isModel };
}

/** Validate + rebuild one manifest slot-param entry. Returns null on structural violation. */
function readSlotParam(raw: unknown): ParamDecl | null {
  if (!isPlainObject(raw)) return null;
  const name = raw.name;
  if (typeof name !== 'string') return null;
  return {
    type: 'ParamDecl',
    name,
    valueExpression: t.identifier(name),
    sourceLoc: { start: 0, end: 0 },
  };
}

/** Validate + rebuild one manifest slot entry into a minimal SlotDecl. */
function readSlot(raw: unknown): SlotDecl | null {
  if (!isPlainObject(raw)) return null;
  const name = raw.name;
  const paramsRaw = raw.params;
  const paramTypesRaw = raw.paramTypes;
  const isPortal = raw.isPortal;
  const isReactive = raw.isReactive;
  if (typeof name !== 'string') return null;
  if (!Array.isArray(paramsRaw)) return null;
  if (paramTypesRaw !== null && !Array.isArray(paramTypesRaw)) return null;
  if (typeof isPortal !== 'boolean') return null;
  if (typeof isReactive !== 'boolean') return null;

  const params: ParamDecl[] = [];
  for (const p of paramsRaw) {
    const param = readSlotParam(p);
    if (param === null) return null;
    params.push(param);
  }

  // T-75-02 — each entry parses independently; a garbage/oversized entry is
  // dropped (that one param only), never fatal to the whole manifest.
  let paramTypes: t.TSType[] | undefined;
  if (paramTypesRaw !== null) {
    const deserialized: t.TSType[] = [];
    for (const src of paramTypesRaw) {
      if (typeof src !== 'string') continue;
      const ty = deserializeParamType(src);
      if (ty !== null) deserialized.push(ty);
    }
    paramTypes = deserialized;
  }

  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params,
    ...(paramTypes !== undefined ? { paramTypes } : {}),
    presence: 'always',
    nestedSlots: [],
    sourceLoc: { start: 0, end: 0 },
    isPortal,
    isReactive,
  };
}

/** Validate + rebuild one manifest expose entry. Returns null on structural violation. */
function readExposeMember(raw: unknown): { name: string } | null {
  if (!isPlainObject(raw)) return null;
  const name = raw.name;
  if (typeof name !== 'string') return null;
  return { name };
}

/**
 * Validate a manifest's `schemaVersion` FIRST (fail closed, D-04), then
 * shape-validate props/slots/emits/expose and deserialize into a
 * `ProducerSurface` consumable by `threadParamTypes` / `validateTwoWayBindings`.
 * Never throws (T-75-01/T-75-02).
 */
export function parseManifest(
  raw: unknown,
  _opts?: ParseManifestOptions,
): ParseManifestResult {
  if (!isPlainObject(raw)) {
    return malformed('Manifest is not a JSON object.');
  }

  // ----- schemaVersion FIRST — fail closed on mismatch/absence (D-04). -----
  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number') {
    return malformed('Manifest is missing a numeric "schemaVersion" field.');
  }
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    return schemaMismatch(
      `Manifest schemaVersion ${schemaVersion} is incompatible with the compiler's MANIFEST_SCHEMA_VERSION ${MANIFEST_SCHEMA_VERSION}. Reinstall a compatible version of the published primitive.`,
    );
  }

  // ----- Structural validation — any violation is MALFORMED_MANIFEST. -----
  const propsRaw = raw.props;
  const slotsRaw = raw.slots;
  const emitsRaw = raw.emits;
  const exposeRaw = raw.expose;

  if (!Array.isArray(propsRaw)) return malformed('Manifest "props" is not an array.');
  if (!Array.isArray(slotsRaw)) return malformed('Manifest "slots" is not an array.');
  if (!Array.isArray(emitsRaw)) return malformed('Manifest "emits" is not an array.');
  if (!Array.isArray(exposeRaw)) return malformed('Manifest "expose" is not an array.');

  const props: Pick<PropDecl, 'name' | 'isModel'>[] = [];
  for (const p of propsRaw) {
    const prop = readProp(p);
    if (prop === null) return malformed('Manifest "props" entry is malformed.');
    props.push(prop);
  }

  const slots: SlotDecl[] = [];
  for (const s of slotsRaw) {
    const slot = readSlot(s);
    if (slot === null) return malformed('Manifest "slots" entry is malformed.');
    slots.push(slot);
  }

  for (const e of emitsRaw) {
    if (typeof e !== 'string') return malformed('Manifest "emits" entry is not a string.');
  }

  const expose: { name: string }[] = [];
  for (const m of exposeRaw) {
    const member = readExposeMember(m);
    if (member === null) return malformed('Manifest "expose" entry is malformed.');
    expose.push(member);
  }

  return { surface: { slots, props, expose }, error: null };
}

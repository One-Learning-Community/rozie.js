/**
 * buildManifest(ir) — the IR → RozieManifest serializer (Phase 75, D-03).
 *
 * A pure `(ir: IRComponent) => RozieManifest` function: no file reads, no env
 * reads, no clock reads. Every field is derived entirely from `lowerToIR()`
 * output, so the manifest can never drift from what was actually compiled —
 * the single-source-of-truth property `event-manifest.mjs` / `handle-
 * manifest.mjs` hand-enforce today via a throw-on-missing-key check.
 *
 * @experimental — shape may change before v1.0
 */
import _generate from '@babel/generator';
import type { IRComponent, PropTypeAnnotation, SlotDecl } from '../ir/types.js';
import { MANIFEST_SCHEMA_VERSION } from './schema.js';
import type {
  RozieManifest,
  RozieManifestProp,
  RozieManifestSlot,
} from './schema.js';

// Default-export interop (see collectScriptDecls.ts / synthesizeHandleType.ts).
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

/**
 * Best-effort informational serialization of a prop's runtime-type token.
 * `isModel`/`required` remain the load-bearing fields consumed by
 * `validateTwoWayBindings` — this string is display/documentation only.
 */
function serializePropType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') return ann.name;
  if (ann.kind === 'literal') return ann.value;
  if (ann.kind === 'union') return ann.members.map(serializePropType).join(' | ');
  return '';
}

/**
 * Serialize one `SlotDecl.paramTypes` array (`TSType[] | undefined`) to the
 * manifest's `string[] | null` shape — one `@babel/generator` source string
 * per TSType entry, or `null` when the source slot declared no paramTypes at
 * all (undefined). `parseManifest` re-parses each string back into a TSType.
 */
function serializeSlotParamTypes(slot: SlotDecl): string[] | null {
  if (slot.paramTypes === undefined) return null;
  return slot.paramTypes.map((t) => generate(t).code);
}

function buildSlot(slot: SlotDecl): RozieManifestSlot {
  return {
    name: slot.name,
    params: slot.params.map((p) => ({ name: p.name })),
    paramTypes: serializeSlotParamTypes(slot),
    isPortal: slot.isPortal === true,
    isReactive: slot.isReactive === true,
  };
}

function buildProp(prop: IRComponent['props'][number]): RozieManifestProp {
  return {
    name: prop.name,
    isModel: prop.isModel,
    required: prop.required,
    type: serializePropType(prop.typeAnnotation),
  };
}

/**
 * Derive a `RozieManifest` entirely from a `lowerToIR()` output — no I/O, no
 * hand-maintained source of truth (D-03). Field order mirrors `IRComponent`
 * source order so the output is deterministic byte-for-byte across runs.
 */
export function buildManifest(ir: IRComponent): RozieManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    name: ir.name,
    props: ir.props.map(buildProp),
    slots: ir.slots.map(buildSlot),
    emits: [...ir.emits],
    expose: ir.expose.map((m) => ({ name: m.name })),
  };
}

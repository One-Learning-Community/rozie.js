/**
 * Hand-kept event-description manifest for @rozie-ui/lexical.
 *
 * Events derive structurally from each .rozie source via ir.emits, but their
 * human-readable descriptions have no first-class IR source — so the prose
 * lives here. The manifest is KEYED BY COMPONENT NAME; within each component,
 * keys must stay in lockstep with that component's ir.emits: codegen.mjs asserts
 * every emitted event name has an entry under its component and throws if one is
 * missing.
 *
 * The editor shell (LexicalEditor) emits NO events in v1.0 — it $provides the
 * live editor for plugins/toolbar to $inject and drive imperatively. Later waves
 * add their own component keys here as they introduce emits.
 */
export const eventManifest = {
  LexicalEditor: {},
};

export default eventManifest;

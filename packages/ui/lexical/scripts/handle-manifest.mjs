/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/lexical.
 *
 * Exposed methods derive structurally from each .rozie source via ir.expose (the
 * $expose({ ... }) call), but their descriptions have no first-class IR source.
 * The manifest is KEYED BY COMPONENT NAME; within each component, keys must stay
 * in lockstep with that component's ir.expose: codegen.mjs asserts every exposed
 * method name has an entry under its component and throws if one is missing.
 *
 * The editor shell (LexicalEditor) exposes NO imperative handle in v1.0 — plugins
 * $inject the $provided editor instead. Later waves add their own component keys.
 */
export const handleManifest = {
  LexicalEditor: {},
};

export default handleManifest;

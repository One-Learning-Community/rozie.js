/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/captcha.
 *
 * Exposed methods derive structurally from Captcha.rozie via ir.expose (the
 * $expose({ ... }) call), but their descriptions have no first-class IR source.
 * KEYS MUST stay in lockstep with ir.expose: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * TODO: add one entry per exposed method, e.g.
 *   reset: 'Reset the widget back to its un-challenged state.',
 */
export const handleManifest = {
  reset: 'Reset the widget to its un-challenged state and clear the two-way `token`.',
  execute: 'Programmatically run the challenge — drives invisible widgets (`size="invisible"`).',
  getResponse: 'Return the current response token on demand (e.g. just before form submit).',
};

export default handleManifest;

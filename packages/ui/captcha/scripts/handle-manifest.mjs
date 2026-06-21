/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/captcha.
 *
 * Exposed methods derive structurally from each .rozie source via ir.expose (the
 * $expose({ ... }) call), but their descriptions have no first-class IR source.
 * The manifest is KEYED BY COMPONENT NAME ({ Captcha, RecaptchaV3 }); within each
 * component, keys must stay in lockstep with that component's ir.expose:
 * codegen.mjs asserts every exposed method name has an entry under its component
 * and throws if one is missing.
 */
export const handleManifest = {
  Captcha: {
    reset: 'Reset the widget to its un-challenged state and clear the two-way `token`.',
    execute: 'Programmatically run the challenge — drives invisible widgets (`size="invisible"`).',
    getResponse: 'Return the current response token on demand (e.g. just before form submit).',
  },
  RecaptchaV3: {
    execute:
      'Run a v3 challenge for the optional `action` (defaults to the `action` prop) and resolve with a fresh token; also writes the two-way `token` and emits `@verify`.',
  },
};

export default handleManifest;

/**
 * Hand-kept event-description manifest for @rozie-ui/captcha.
 *
 * Events derive structurally from each .rozie source via ir.emits, but their
 * human-readable descriptions have no first-class IR source — so the prose
 * lives here. The manifest is KEYED BY COMPONENT NAME ({ Captcha, RecaptchaV3 });
 * within each component, keys must stay in lockstep with that component's
 * ir.emits: codegen.mjs asserts every emitted event name has an entry under its
 * component and throws if one is missing.
 */
export const eventManifest = {
  Captcha: {
    verify: 'Fired when the user completes the challenge. Payload `{ token, provider }`.',
    expire: 'Fired when the verified token expires. Payload `{ provider }`.',
    error: 'Fired on a challenge or script-load failure. Payload `{ provider, error? }`.',
  },
  RecaptchaV3: {
    verify: 'Fired on a successful `execute()`. Payload `{ token, action }`.',
    error: 'Fired on a load timeout, script error, or a rejected `execute()`. Payload `{ error? }`.',
  },
};

export default eventManifest;

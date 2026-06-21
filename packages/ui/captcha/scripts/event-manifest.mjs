/**
 * Hand-kept event-description manifest for @rozie-ui/captcha.
 *
 * Events derive structurally from Captcha.rozie via ir.emits, but their
 * human-readable descriptions have no first-class IR source — so the prose
 * lives here. KEYS MUST stay in lockstep with ir.emits: codegen.mjs asserts
 * every emitted event name has an entry here and throws if one is missing.
 *
 * TODO: add one entry per event your source emits, e.g.
 *   verify: 'Fired when the user completes the challenge. Payload `{ token }`.',
 */
export const eventManifest = {
  verify: 'Fired when the user completes the challenge. Payload `{ token, provider }`.',
  expire: 'Fired when the verified token expires. Payload `{ provider }`.',
  error: 'Fired on a challenge or script-load failure. Payload `{ provider, error? }`.',
};

export default eventManifest;

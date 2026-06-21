export { default as Captcha } from './Captcha';
export { default } from './Captcha';
export { default as RecaptchaV3 } from './RecaptchaV3';

/** The `$expose` imperative handle for Captcha received via `ref` — { reset, execute, getResponse }. */
export type { CaptchaHandle } from './Captcha';

/** The `$expose` imperative handle for RecaptchaV3 received via `ref` — { execute }. */
export type { RecaptchaV3Handle } from './RecaptchaV3';

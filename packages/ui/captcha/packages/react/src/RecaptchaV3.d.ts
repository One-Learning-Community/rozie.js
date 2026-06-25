import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface RecaptchaV3Props {
  /**
   * Required. The public reCAPTCHA v3 site key from your Google admin console.
   */
  sitekey: string;
  /**
   * The default action label reported to reCAPTCHA's risk analysis (e.g. `submit`, `login`). Overridable per call via `execute(action)`.
   */
  action?: string;
  /**
   * The latest verification token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written on each successful `execute()` — read it to attach the fresh token to your request.
   * @example
   * <RecaptchaV3 r-model:token="token" sitekey="…" action="signup" />
   */
  token?: string;
  defaultToken?: string;
  onTokenChange?: (next: string) => void;
  /**
   * Opt in to running one `execute()` at mount and emitting `@verify` with the initial token. Off by default — v3 is imperative-first and tokens are short-lived (~2 min), so fetch one at the moment of submission rather than eagerly at mount.
   */
  executeOnMount?: boolean;
  onError?: (...args: unknown[]) => void;
  onVerify?: (...args: unknown[]) => void;
}

export interface RecaptchaV3Handle {
  execute: (...args: any[]) => any;
}

declare const RecaptchaV3: React.ForwardRefExoticComponent<RecaptchaV3Props & React.RefAttributes<RecaptchaV3Handle>>;
export default RecaptchaV3;

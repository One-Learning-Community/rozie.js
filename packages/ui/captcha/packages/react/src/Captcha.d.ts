import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CaptchaProps {
  /**
   * Which widget to render: `recaptcha` (Google reCAPTCHA v2), `hcaptcha`, `turnstile` (Cloudflare), or `friendly` (Friendly Captcha). The first three share a near-identical explicit-render API; Friendly Captcha rides an internal `adapt()` bridge onto the same surface. Construction-time — re-key the component to switch it live.
   */
  provider?: string;
  /**
   * Required. The public site key from your provider dashboard. Identifies your site to the chosen provider.
   */
  sitekey: string;
  /**
   * The verified response token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written by the widget on success and cleared on expire/reset, so reading it gives you the live response to send to your server for form submission.
   * @example
   * <Captcha r-model:token="token" provider="recaptcha" sitekey="…" />
   */
  token?: string;
  defaultToken?: string;
  onTokenChange?: (next: string) => void;
  /**
   * Widget color theme: `light` or `dark` (all three core providers), or `auto` (Turnstile only). Construction-time — re-key the component to change it live.
   */
  theme?: string;
  /**
   * Widget size. reCAPTCHA/hCaptcha accept `normal`/`compact`/`invisible`; Turnstile accepts `normal`/`compact`/`flexible`. A no-op for Friendly Captcha (its `startMode` analog rides through the `options` escape hatch instead). Construction-time.
   */
  size?: string;
  /**
   * Optional tab index forwarded to the rendered widget. Omitted from the render config when left unset (`null`).
   */
  tabindex?: (number) | null;
  /**
   * Escape hatch — provider-specific render options merged last (e.g. Turnstile `action`/`cData`/`retry`, hCaptcha `hl`, reCAPTCHA `badge`, Friendly Captcha `startMode`). Lets you reach keys this component does not promote to first-class props.
   */
  options?: Record<string, unknown>;
  onVerify?: (...args: unknown[]) => void;
  onExpire?: (...args: unknown[]) => void;
  onError?: (...args: unknown[]) => void;
}

export interface CaptchaHandle {
  reset: (...args: any[]) => any;
  execute: (...args: any[]) => any;
  getResponse: (...args: any[]) => any;
}

declare const Captcha: React.ForwardRefExoticComponent<CaptchaProps & React.RefAttributes<CaptchaHandle>>;
export default Captcha;

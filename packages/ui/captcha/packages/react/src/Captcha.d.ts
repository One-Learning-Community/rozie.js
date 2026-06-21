import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CaptchaProps {
  provider?: string;
  sitekey: string;
  token?: string;
  defaultToken?: string;
  onTokenChange?: (next: string) => void;
  theme?: string;
  size?: string;
  tabindex?: (number) | null;
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

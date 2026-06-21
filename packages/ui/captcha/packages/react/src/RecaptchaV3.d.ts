import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface RecaptchaV3Props {
  sitekey: string;
  action?: string;
  token?: string;
  defaultToken?: string;
  onTokenChange?: (next: string) => void;
  executeOnMount?: boolean;
  onError?: (...args: unknown[]) => void;
  onVerify?: (...args: unknown[]) => void;
}

export interface RecaptchaV3Handle {
  execute: (...args: any[]) => any;
}

declare const RecaptchaV3: React.ForwardRefExoticComponent<RecaptchaV3Props & React.RefAttributes<RecaptchaV3Handle>>;
export default RecaptchaV3;

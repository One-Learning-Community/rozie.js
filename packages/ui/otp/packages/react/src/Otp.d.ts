import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface OtpProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  length?: number;
  type?: string;
  mask?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
  onComplete?: (...args: unknown[]) => void;
}

export interface OtpHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const Otp: React.ForwardRefExoticComponent<OtpProps & React.RefAttributes<OtpHandle>>;
export default Otp;

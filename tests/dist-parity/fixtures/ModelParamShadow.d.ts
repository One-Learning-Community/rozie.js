import type { ReactNode } from 'react';

export interface ModelParamShadowProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'token' | 'defaultToken' | 'onTokenChange' | 'onVerify' | 'children' | 'dangerouslySetInnerHTML'> {
  token?: string;
  defaultToken?: string;
  onTokenChange?: (next: string) => void;
  onVerify?: (...args: unknown[]) => void;
}

declare function ModelParamShadow(props: ModelParamShadowProps): JSX.Element;
export default ModelParamShadow;

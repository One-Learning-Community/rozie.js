import type { ReactNode } from 'react';

export interface CvaOffStateProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'value' | 'defaultValue' | 'onValueChange' | 'children' | 'dangerouslySetInnerHTML'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
}

declare function CvaOffState(props: CvaOffStateProps): JSX.Element;
export default CvaOffState;

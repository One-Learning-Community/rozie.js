import type { ReactNode } from 'react';

export interface CvaOffStateProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
}

declare function CvaOffState(props: CvaOffStateProps): JSX.Element;
export default CvaOffState;

import type { ReactNode } from 'react';

export interface ThemedButtonManualProps {
  label?: string;
  variant?: string;
}

declare function ThemedButtonManual(props: ThemedButtonManualProps): JSX.Element;
export default ThemedButtonManual;

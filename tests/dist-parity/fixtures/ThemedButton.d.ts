import type { ReactNode } from 'react';

export interface ThemedButtonProps {
  label?: string;
  variant?: string;
}

declare function ThemedButton(props: ThemedButtonProps): JSX.Element;
export default ThemedButton;

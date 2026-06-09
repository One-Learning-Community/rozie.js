import type { ReactNode } from 'react';

export interface ThemeProviderProps {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ThemeProvider(props: ThemeProviderProps): JSX.Element;
export default ThemeProvider;

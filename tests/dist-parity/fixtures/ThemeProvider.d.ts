import type { ReactNode } from 'react';

export interface ThemeProviderProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ThemeProvider(props: ThemeProviderProps): JSX.Element;
export default ThemeProvider;

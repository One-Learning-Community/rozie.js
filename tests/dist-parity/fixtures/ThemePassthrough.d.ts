import type { ReactNode } from 'react';

export interface ThemePassthroughProps {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ThemePassthrough(props: ThemePassthroughProps): JSX.Element;
export default ThemePassthrough;

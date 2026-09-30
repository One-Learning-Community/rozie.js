import type { ReactNode } from 'react';

export interface ThemePassthroughProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ThemePassthrough(props: ThemePassthroughProps): JSX.Element;
export default ThemePassthrough;

import type { ReactNode } from 'react';

export interface TabsProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Tabs(props: TabsProps): JSX.Element;
export default Tabs;

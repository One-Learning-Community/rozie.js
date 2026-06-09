import type { ReactNode } from 'react';

export interface TabsProps {
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Tabs(props: TabsProps): JSX.Element;
export default Tabs;

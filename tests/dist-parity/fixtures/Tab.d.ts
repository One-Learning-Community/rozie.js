import type { ReactNode } from 'react';

export interface TabProps {
  label?: string;
  index?: number;
}

declare function Tab(props: TabProps): JSX.Element;
export default Tab;

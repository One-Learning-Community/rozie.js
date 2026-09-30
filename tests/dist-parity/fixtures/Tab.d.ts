import type { ReactNode } from 'react';

export interface TabProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'label' | 'index' | 'children' | 'dangerouslySetInnerHTML'> {
  label?: string;
  index?: number;
}

declare function Tab(props: TabProps): JSX.Element;
export default Tab;

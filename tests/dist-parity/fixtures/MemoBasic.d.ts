import type { ReactNode } from 'react';

export interface MemoBasicProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'items' | 'children' | 'dangerouslySetInnerHTML'> {
  items?: unknown[];
}

declare function MemoBasic(props: MemoBasicProps): JSX.Element;
export default MemoBasic;

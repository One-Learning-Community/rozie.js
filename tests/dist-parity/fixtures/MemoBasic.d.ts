import type { ReactNode } from 'react';

export interface MemoBasicProps {
  items?: unknown[];
}

declare function MemoBasic(props: MemoBasicProps): JSX.Element;
export default MemoBasic;

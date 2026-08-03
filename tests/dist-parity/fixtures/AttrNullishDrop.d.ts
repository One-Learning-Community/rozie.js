import type { ReactNode } from 'react';

export interface AttrNullishDropProps {
  maybeNullProp?: (string) | null;
}

declare function AttrNullishDrop(props: AttrNullishDropProps): JSX.Element;
export default AttrNullishDrop;

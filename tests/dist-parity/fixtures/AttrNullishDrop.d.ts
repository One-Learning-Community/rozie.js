import type { ReactNode } from 'react';

export interface AttrNullishDropProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'maybeNullProp' | 'children' | 'dangerouslySetInnerHTML'> {
  maybeNullProp?: (string) | null;
}

declare function AttrNullishDrop(props: AttrNullishDropProps): JSX.Element;
export default AttrNullishDrop;

import type { ReactNode } from 'react';

export interface BareAttrComponentProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function BareAttrComponent(props: BareAttrComponentProps): JSX.Element;
export default BareAttrComponent;

import type { ReactNode } from 'react';

export interface RModelLazyProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function RModelLazy(props: RModelLazyProps): JSX.Element;
export default RModelLazy;

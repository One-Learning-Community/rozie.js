import type { ReactNode } from 'react';

export interface ObjectInterpProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function ObjectInterp(props: ObjectInterpProps): JSX.Element;
export default ObjectInterp;

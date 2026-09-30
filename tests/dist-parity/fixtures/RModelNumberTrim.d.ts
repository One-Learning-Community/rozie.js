import type { ReactNode } from 'react';

export interface RModelNumberTrimProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function RModelNumberTrim(props: RModelNumberTrimProps): JSX.Element;
export default RModelNumberTrim;

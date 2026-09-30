import type { ReactNode } from 'react';

export interface InlineEquivHostIProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostI(props: InlineEquivHostIProps): JSX.Element;
export default InlineEquivHostI;

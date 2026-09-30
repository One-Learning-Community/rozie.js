import type { ReactNode } from 'react';

export interface InlineEquivHostLProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostL(props: InlineEquivHostLProps): JSX.Element;
export default InlineEquivHostL;

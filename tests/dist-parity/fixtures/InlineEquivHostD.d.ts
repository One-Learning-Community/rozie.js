import type { ReactNode } from 'react';

export interface InlineEquivHostDProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostD(props: InlineEquivHostDProps): JSX.Element;
export default InlineEquivHostD;

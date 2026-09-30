import type { ReactNode } from 'react';

export interface InlineEquivHostHProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostH(props: InlineEquivHostHProps): JSX.Element;
export default InlineEquivHostH;

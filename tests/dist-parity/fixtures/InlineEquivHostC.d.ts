import type { ReactNode } from 'react';

export interface InlineEquivHostCProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostC(props: InlineEquivHostCProps): JSX.Element;
export default InlineEquivHostC;

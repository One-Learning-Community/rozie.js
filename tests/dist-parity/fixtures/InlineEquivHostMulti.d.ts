import type { ReactNode } from 'react';

export interface InlineEquivHostMultiProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostMulti(props: InlineEquivHostMultiProps): JSX.Element;
export default InlineEquivHostMulti;

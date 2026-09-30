import type { ReactNode } from 'react';

export interface InlineEquivHostEProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostE(props: InlineEquivHostEProps): JSX.Element;
export default InlineEquivHostE;

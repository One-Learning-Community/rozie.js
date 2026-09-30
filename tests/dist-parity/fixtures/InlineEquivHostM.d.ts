import type { ReactNode } from 'react';

export interface InlineEquivHostMProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostM(props: InlineEquivHostMProps): JSX.Element;
export default InlineEquivHostM;

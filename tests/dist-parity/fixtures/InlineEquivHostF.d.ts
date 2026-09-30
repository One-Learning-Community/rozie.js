import type { ReactNode } from 'react';

export interface InlineEquivHostFProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostF(props: InlineEquivHostFProps): JSX.Element;
export default InlineEquivHostF;

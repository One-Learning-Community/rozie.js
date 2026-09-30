import type { ReactNode } from 'react';

export interface InlineEquivHostKProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostK(props: InlineEquivHostKProps): JSX.Element;
export default InlineEquivHostK;

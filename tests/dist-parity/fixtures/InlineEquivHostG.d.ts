import type { ReactNode } from 'react';

export interface InlineEquivHostGProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostG(props: InlineEquivHostGProps): JSX.Element;
export default InlineEquivHostG;

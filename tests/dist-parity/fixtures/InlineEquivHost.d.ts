import type { ReactNode } from 'react';

export interface InlineEquivHostProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHost(props: InlineEquivHostProps): JSX.Element;
export default InlineEquivHost;

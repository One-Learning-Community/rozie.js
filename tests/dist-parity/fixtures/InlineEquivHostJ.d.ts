import type { ReactNode } from 'react';

export interface InlineEquivHostJProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function InlineEquivHostJ(props: InlineEquivHostJProps): JSX.Element;
export default InlineEquivHostJ;

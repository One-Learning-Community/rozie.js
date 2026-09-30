import type { ReactNode } from 'react';

export interface PartialInlineHostCProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostC(props: PartialInlineHostCProps): JSX.Element;
export default PartialInlineHostC;

import type { ReactNode } from 'react';

export interface PartialInlineHostIProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostI(props: PartialInlineHostIProps): JSX.Element;
export default PartialInlineHostI;

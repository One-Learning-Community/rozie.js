import type { ReactNode } from 'react';

export interface PartialInlineHostHProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostH(props: PartialInlineHostHProps): JSX.Element;
export default PartialInlineHostH;

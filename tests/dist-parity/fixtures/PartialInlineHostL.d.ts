import type { ReactNode } from 'react';

export interface PartialInlineHostLProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostL(props: PartialInlineHostLProps): JSX.Element;
export default PartialInlineHostL;

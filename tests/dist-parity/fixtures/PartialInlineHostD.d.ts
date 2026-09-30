import type { ReactNode } from 'react';

export interface PartialInlineHostDProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostD(props: PartialInlineHostDProps): JSX.Element;
export default PartialInlineHostD;

import type { ReactNode } from 'react';

export interface PartialInlineHostMultiProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostMulti(props: PartialInlineHostMultiProps): JSX.Element;
export default PartialInlineHostMulti;

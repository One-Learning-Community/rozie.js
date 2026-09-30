import type { ReactNode } from 'react';

export interface PartialInlineHostEProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostE(props: PartialInlineHostEProps): JSX.Element;
export default PartialInlineHostE;

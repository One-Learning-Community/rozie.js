import type { ReactNode } from 'react';

export interface PartialInlineHostMProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostM(props: PartialInlineHostMProps): JSX.Element;
export default PartialInlineHostM;

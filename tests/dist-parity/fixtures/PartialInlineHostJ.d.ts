import type { ReactNode } from 'react';

export interface PartialInlineHostJProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostJ(props: PartialInlineHostJProps): JSX.Element;
export default PartialInlineHostJ;

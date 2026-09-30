import type { ReactNode } from 'react';

export interface PartialInlineHostKProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostK(props: PartialInlineHostKProps): JSX.Element;
export default PartialInlineHostK;

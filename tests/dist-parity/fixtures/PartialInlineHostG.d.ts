import type { ReactNode } from 'react';

export interface PartialInlineHostGProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostG(props: PartialInlineHostGProps): JSX.Element;
export default PartialInlineHostG;

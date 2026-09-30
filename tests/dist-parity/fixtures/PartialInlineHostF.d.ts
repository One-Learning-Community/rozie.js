import type { ReactNode } from 'react';

export interface PartialInlineHostFProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHostF(props: PartialInlineHostFProps): JSX.Element;
export default PartialInlineHostF;

import type { ReactNode } from 'react';

export interface PartialInlineHostProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'base' | 'children' | 'dangerouslySetInnerHTML'> {
  base?: number;
}

declare function PartialInlineHost(props: PartialInlineHostProps): JSX.Element;
export default PartialInlineHost;

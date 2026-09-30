import type { ReactNode } from 'react';

export interface BareAttrChildProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'combobox' | 'children' | 'dangerouslySetInnerHTML'> {
  combobox?: boolean;
}

declare function BareAttrChild(props: BareAttrChildProps): JSX.Element;
export default BareAttrChild;

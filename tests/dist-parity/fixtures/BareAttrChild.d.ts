import type { ReactNode } from 'react';

export interface BareAttrChildProps {
  combobox?: boolean;
}

declare function BareAttrChild(props: BareAttrChildProps): JSX.Element;
export default BareAttrChild;

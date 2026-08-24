import type { ReactNode } from 'react';

export interface ElementPlusSlotFallthroughProps {
  variant?: string;
  renderHeader?: () => ReactNode;
  children?: ReactNode;
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ElementPlusSlotFallthrough(props: ElementPlusSlotFallthroughProps): JSX.Element;
export default ElementPlusSlotFallthrough;

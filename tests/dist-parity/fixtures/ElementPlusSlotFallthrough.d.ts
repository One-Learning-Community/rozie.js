import type { ReactNode } from 'react';

export interface ElementPlusSlotFallthroughProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'variant' | 'renderHeader' | 'children' | 'renderFooter' | 'slots' | 'dangerouslySetInnerHTML'> {
  variant?: string;
  renderHeader?: () => ReactNode;
  children?: ReactNode;
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function ElementPlusSlotFallthrough(props: ElementPlusSlotFallthroughProps): JSX.Element;
export default ElementPlusSlotFallthrough;

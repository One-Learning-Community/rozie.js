import type { ReactNode } from 'react';

export interface PortalListStyledProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'items' | 'renderItem' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  items?: unknown[];
  renderItem?: (params: { item: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PortalListStyled(props: PortalListStyledProps): JSX.Element;
export default PortalListStyled;

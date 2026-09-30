import type { ReactNode } from 'react';

export interface PortalListStyledScssProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'items' | 'renderItem' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  items?: unknown[];
  renderItem?: (params: { item: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PortalListStyledScss(props: PortalListStyledScssProps): JSX.Element;
export default PortalListStyledScss;

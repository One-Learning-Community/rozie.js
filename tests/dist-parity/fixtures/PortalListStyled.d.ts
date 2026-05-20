import type { ReactNode } from 'react';

export interface PortalListStyledProps {
  items?: unknown[];
  renderItem?: (params: { item: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PortalListStyled(props: PortalListStyledProps): JSX.Element;
export default PortalListStyled;

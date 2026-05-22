import type { ReactNode } from 'react';

export interface PortalListStyledScssProps {
  items?: unknown[];
  renderItem?: (params: { item: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PortalListStyledScss(props: PortalListStyledScssProps): JSX.Element;
export default PortalListStyledScss;

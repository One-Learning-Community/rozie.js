import type { ReactNode } from 'react';

export interface PortalOverlayProps {
  open?: boolean;
  to?: boolean | string;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PortalOverlay(props: PortalOverlayProps): JSX.Element;
export default PortalOverlay;

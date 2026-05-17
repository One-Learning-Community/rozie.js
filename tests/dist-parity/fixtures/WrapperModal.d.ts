import type { ReactNode } from 'react';

export interface WrapperModalProps {
  title?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  renderBrand?: () => ReactNode;
  children?: ReactNode;
  renderActions?: () => ReactNode;
}

declare function WrapperModal(props: WrapperModalProps): JSX.Element;
export default WrapperModal;

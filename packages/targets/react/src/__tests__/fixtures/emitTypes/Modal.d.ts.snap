import type { ReactNode } from 'react';

export interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  renderHeader?: (params: { close: unknown }) => ReactNode;
  children?: ReactNode | ((params: { close: unknown }) => ReactNode);
  renderFooter?: (params: { close: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Modal(props: ModalProps): JSX.Element;
export default Modal;

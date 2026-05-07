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
  renderHeader?: (params: { close: () => void }) => ReactNode;
  children?: ReactNode | ((params: { close: () => void }) => ReactNode);
  renderFooter?: (params: { close: () => void }) => ReactNode;
}

declare function Modal(props: ModalProps): JSX.Element;
export default Modal;

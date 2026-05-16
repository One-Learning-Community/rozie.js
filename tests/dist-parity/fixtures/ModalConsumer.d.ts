import type { ReactNode } from 'react';

export interface ModalConsumerProps {
  title?: string;
}

declare function ModalConsumer(props: ModalConsumerProps): JSX.Element;
export default ModalConsumer;

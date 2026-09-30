import type { ReactNode } from 'react';

export interface ModalConsumerProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'title' | 'children' | 'dangerouslySetInnerHTML'> {
  title?: string;
}

declare function ModalConsumer(props: ModalConsumerProps): JSX.Element;
export default ModalConsumer;

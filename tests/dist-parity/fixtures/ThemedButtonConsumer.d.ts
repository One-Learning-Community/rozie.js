import type { ReactNode } from 'react';

export interface ThemedButtonConsumerProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function ThemedButtonConsumer(props: ThemedButtonConsumerProps): JSX.Element;
export default ThemedButtonConsumer;

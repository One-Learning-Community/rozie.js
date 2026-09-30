import type { ReactNode } from 'react';

export interface DynamicSlotsConsumerProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function DynamicSlotsConsumer(props: DynamicSlotsConsumerProps): JSX.Element;
export default DynamicSlotsConsumer;

import type { ReactNode } from 'react';

export interface PartCardConsumerProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function PartCardConsumer(props: PartCardConsumerProps): JSX.Element;
export default PartCardConsumer;

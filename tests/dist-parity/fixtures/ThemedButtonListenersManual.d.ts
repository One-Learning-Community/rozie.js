import type { ReactNode } from 'react';

export interface ThemedButtonListenersManualProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'label' | 'variant' | 'children' | 'dangerouslySetInnerHTML'> {
  label?: string;
  variant?: string;
}

declare function ThemedButtonListenersManual(props: ThemedButtonListenersManualProps): JSX.Element;
export default ThemedButtonListenersManual;

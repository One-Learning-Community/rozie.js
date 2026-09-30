import type { ReactNode } from 'react';

export interface ThemedButtonProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'label' | 'variant' | 'children' | 'dangerouslySetInnerHTML'> {
  label?: string;
  variant?: string;
}

declare function ThemedButton(props: ThemedButtonProps): JSX.Element;
export default ThemedButton;

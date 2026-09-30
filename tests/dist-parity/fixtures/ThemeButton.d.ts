import type { ReactNode } from 'react';

export interface ThemeButtonProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'children' | 'dangerouslySetInnerHTML'> {
}

declare function ThemeButton(props: ThemeButtonProps): JSX.Element;
export default ThemeButton;

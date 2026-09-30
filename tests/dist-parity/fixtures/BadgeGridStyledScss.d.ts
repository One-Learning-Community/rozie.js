import type { ReactNode } from 'react';

export interface BadgeGridStyledScssProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'badges' | 'children' | 'dangerouslySetInnerHTML'> {
  badges?: unknown[];
}

declare function BadgeGridStyledScss(props: BadgeGridStyledScssProps): JSX.Element;
export default BadgeGridStyledScss;

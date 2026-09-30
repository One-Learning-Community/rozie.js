import type { ReactNode } from 'react';

export interface PartCardProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'title' | 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  title?: string;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PartCard(props: PartCardProps): JSX.Element;
export default PartCard;

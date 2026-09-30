import type { ReactNode } from 'react';

export interface CardProps extends Omit<import('react').ComponentPropsWithoutRef<'article'>, 'title' | 'onClose' | 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Card(props: CardProps): JSX.Element;
export default Card;

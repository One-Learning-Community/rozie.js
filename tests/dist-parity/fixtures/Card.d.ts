import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  onClose?: ((...args: unknown[]) => unknown) | null;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Card(props: CardProps): JSX.Element;
export default Card;

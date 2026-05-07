import type { ReactNode } from 'react';

export interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

declare function CardHeader(props: CardHeaderProps): JSX.Element;
export default CardHeader;

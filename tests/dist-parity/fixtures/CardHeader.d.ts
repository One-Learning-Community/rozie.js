import type { ReactNode } from 'react';

export interface CardHeaderProps extends Omit<import('react').ComponentPropsWithoutRef<'header'>, 'title' | 'onClose' | 'children' | 'dangerouslySetInnerHTML'> {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
}

declare function CardHeader(props: CardHeaderProps): JSX.Element;
export default CardHeader;

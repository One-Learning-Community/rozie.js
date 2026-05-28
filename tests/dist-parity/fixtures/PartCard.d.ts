import type { ReactNode } from 'react';

export interface PartCardProps {
  title?: string;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function PartCard(props: PartCardProps): JSX.Element;
export default PartCard;

import type { ReactNode } from 'react';

export interface SourceProps {
  id: string;
  spec?: unknown;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Source(props: SourceProps): JSX.Element;
export default Source;

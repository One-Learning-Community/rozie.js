import type { ReactNode } from 'react';

export interface ConnectionProps {
  id?: string;
  source: string;
  sourceOutput?: string;
  target: string;
  targetInput?: string;
}

declare function Connection(props: ConnectionProps): JSX.Element;
export default Connection;

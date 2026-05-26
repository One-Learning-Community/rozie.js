import type { ReactNode } from 'react';

export interface PropDefaultCoercionProps {
  a?: (Record<string, unknown>) | null;
  b?: number;
  c?: string;
  d?: boolean;
  e?: unknown[];
  f?: Record<string, unknown>;
}

declare function PropDefaultCoercion(props: PropDefaultCoercionProps): JSX.Element;
export default PropDefaultCoercion;

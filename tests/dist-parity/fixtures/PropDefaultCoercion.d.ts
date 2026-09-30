import type { ReactNode } from 'react';

export interface PropDefaultCoercionProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'children' | 'dangerouslySetInnerHTML'> {
  a?: (Record<string, unknown>) | null;
  b?: number;
  c?: string;
  d?: boolean;
  e?: unknown[];
  f?: Record<string, unknown>;
}

declare function PropDefaultCoercion(props: PropDefaultCoercionProps): JSX.Element;
export default PropDefaultCoercion;

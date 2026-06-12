import type { ReactNode } from 'react';

export interface PortProps {
  output?: string;
  input?: string;
  type?: string;
  label?: string;
  multiple?: unknown;
  position?: string;
}

declare function Port(props: PortProps): JSX.Element;
export default Port;

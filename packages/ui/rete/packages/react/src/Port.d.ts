import type { ReactNode } from 'react';

export interface PortProps {
  out?: string;
  in?: string;
  type?: string;
  label?: unknown;
  multiple?: unknown;
}

declare function Port(props: PortProps): JSX.Element;
export default Port;

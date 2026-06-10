import type { ReactNode } from 'react';

export interface HandleProps {
  side?: string;
  port: string;
  label?: unknown;
  multiple?: unknown;
}

declare function Handle(props: HandleProps): JSX.Element;
export default Handle;

import type { ReactNode } from 'react';

export interface FlowNodeProps {
  id: string;
  x?: number;
  y?: number;
  label?: unknown;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function FlowNode(props: FlowNodeProps): JSX.Element;
export default FlowNode;

import type { ReactNode } from 'react';

export interface NodeTypeProps {
  type: string;
  renderBody?: (params: { node: () => void; selected: () => void; emit: () => void }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function NodeType(props: NodeTypeProps): JSX.Element;
export default NodeType;

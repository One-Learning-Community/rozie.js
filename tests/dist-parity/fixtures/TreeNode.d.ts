import type { ReactNode } from 'react';

export interface TreeNodeProps {
  node?: Record<string, unknown>;
}

declare function TreeNode(props: TreeNodeProps): JSX.Element;
export default TreeNode;

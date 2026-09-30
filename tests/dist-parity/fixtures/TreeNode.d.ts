import type { ReactNode } from 'react';

export interface TreeNodeProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'node' | 'children' | 'dangerouslySetInnerHTML'> {
  node?: Record<string, unknown>;
}

declare function TreeNode(props: TreeNodeProps): JSX.Element;
export default TreeNode;

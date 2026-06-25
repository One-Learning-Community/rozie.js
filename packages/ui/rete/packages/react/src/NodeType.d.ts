import type { ReactNode } from 'react';

export interface NodeTypeProps {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><template #body="{ node }">{{ node.data.label }}</template></NodeType>
   */
  type: string;
  renderBody?: (params: { node: () => void; selected: () => void; emit: () => void }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function NodeType(props: NodeTypeProps): JSX.Element;
export default NodeType;

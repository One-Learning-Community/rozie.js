import type { ReactNode } from 'react';

export interface NodeTypeProps {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><template #body="{ node }">{{ node.data.label }}</template></NodeType>
   */
  type: string;
  /**
   * Opt this node TYPE into corner-handle resizing (default OFF). When true, selecting a node of this type shows 4 corner drag handles (the React Flow <NodeResizer/> parity); dragging one persists an explicit node.width/node.height (a fixed box, D-07) that overrides auto-sizing for that node instance. A double-click on a handle resets the node back to auto-size.
   */
  resizable?: boolean;
  /**
   * Minimum width (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minWidth?: (number) | null;
  /**
   * Minimum height (px) a resize gesture may shrink this type to. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minHeight?: (number) | null;
  /**
   * Maximum width (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxWidth?: (number) | null;
  /**
   * Maximum height (px) a resize gesture may grow this type to. Unset = unbounded growth.
   */
  maxHeight?: (number) | null;
  renderBody?: (params: { node: () => void; selected: () => void; emit: () => void }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function NodeType(props: NodeTypeProps): JSX.Element;
export default NodeType;

import type { ReactNode } from 'react';

export interface NodeTypeProps {
  /**
   * The node TYPE id (required). Every graph node whose `type` matches renders this template and uses this type's `<Port>` schema. There is no id/x/y here — this is a render-by-type TEMPLATE, not an instance; instance identity and position live in the bound `graph` model.
   * @example
   * <NodeType type="source"><Port output="num" type="number" /></NodeType>
   */
  type: string;
  /**
   * Opt this node TYPE into corner-handle resizing (default OFF). When true, selecting a node of this type shows 4 corner drag handles (the React Flow <NodeResizer/> parity); dragging one persists an explicit node.width/node.height (a fixed box, D-07) that overrides auto-sizing for that node instance. A double-click on a handle resets the node back to auto-size.
   */
  resizable?: boolean;
  /**
   * Fixed width (px) for EVERY node of this type — the design-consistency knob, so a node does not resize as its `#body` content changes. Unset (the default) auto-sizes to the body. A node instance's own `width` in the bound graph (what a `resizable` corner-drag persists) overrides this; `minWidth`/`maxWidth` clamp whichever wins. An explicit width also lowers the default 140px node floor, so a value below it renders as authored.
   * @example
   * <NodeType type="task" width={240}><Port output="out" /></NodeType>
   */
  width?: (number) | null;
  /**
   * Fixed height (px) for EVERY node of this type. Unset (the default) auto-sizes to the body. Same precedence as `width`: a node instance's own `height` overrides it, and `minHeight`/`maxHeight` clamp the result.
   * @example
   * <NodeType type="task" height={120}><Port output="out" /></NodeType>
   */
  height?: (number) | null;
  /**
   * Minimum width (px) for this type. Clamps the RENDERED box whatever its size came from — auto-sized body content, an authored `width`, or a resize gesture — and bounds how far a corner-drag may shrink it. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minWidth?: (number) | null;
  /**
   * Minimum height (px) for this type. Clamps the RENDERED box whatever its size came from, and bounds how far a corner-drag may shrink it. Falls back to a small sane default (~40px) if resizable is true and this is unset, so a node can never be dragged to 0px.
   */
  minHeight?: (number) | null;
  /**
   * Maximum width (px) for this type. Clamps the RENDERED box whatever its size came from — auto-sized body content, an authored `width`, or a resize gesture — so body content can never stretch a node past it. Unset = unbounded.
   */
  maxWidth?: (number) | null;
  /**
   * Maximum height (px) for this type. Clamps the RENDERED box whatever its size came from, so body content can never stretch a node past it. Unset = unbounded.
   */
  maxHeight?: (number) | null;
  renderBody?: (params: { node: unknown; selected: unknown; emit: unknown }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function NodeType(props: NodeTypeProps): JSX.Element;
export default NodeType;

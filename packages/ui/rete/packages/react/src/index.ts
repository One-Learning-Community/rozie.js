export { default as FlowCanvas } from './FlowCanvas';
export { default } from './FlowCanvas';
export { default as FlowNode } from './FlowNode';
export { default as Handle } from './Handle';
export { default as Connection } from './Connection';

/** The `$expose` imperative handle received via `ref` — { getEditor, getArea, addNode, removeNode, addConnection, removeConnection, clear, zoomToFit, zoomTo, getNodes, getConnections, getTransform }. */
export type { FlowCanvasHandle } from './FlowCanvas';

import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface FlowCanvasProps {
  graph?: Record<string, unknown>;
  defaultGraph?: Record<string, unknown>;
  onGraphChange?: (next: Record<string, unknown>) => void;
  validateTypes?: boolean;
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (next: number) => void;
  pannable?: boolean;
  zoomable?: boolean;
  selectable?: boolean;
  readonly?: boolean;
  minZoom?: number;
  maxZoom?: number;
  snapGrid?: number;
  accumulateOnCtrl?: boolean;
  curvature?: number;
  fitOnMount?: boolean;
  canConnect?: ((...args: unknown[]) => unknown) | null;
  onNodeAction?: (...args: unknown[]) => void;
  onConnectionRejected?: (...args: unknown[]) => void;
  onConnectionCreated?: (...args: unknown[]) => void;
  onConnectionRemoved?: (...args: unknown[]) => void;
  onNodePicked?: (...args: unknown[]) => void;
  onNodeMoved?: (...args: unknown[]) => void;
  onTranslated?: (...args: unknown[]) => void;
  onContextMenu?: (...args: unknown[]) => void;
  renderNode?: (params: { node: () => void; selected: () => void; emit: () => void }) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface FlowCanvasHandle {
  getEditor: (...args: any[]) => any;
  getArea: (...args: any[]) => any;
  addNode: (...args: any[]) => any;
  removeNode: (...args: any[]) => any;
  addConnection: (...args: any[]) => any;
  removeConnection: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  zoomToFit: (...args: any[]) => any;
  zoomTo: (...args: any[]) => any;
  getNodes: (...args: any[]) => any;
  getConnections: (...args: any[]) => any;
  getTransform: (...args: any[]) => any;
}

declare const FlowCanvas: React.ForwardRefExoticComponent<FlowCanvasProps & React.RefAttributes<FlowCanvasHandle>>;
export default FlowCanvas;

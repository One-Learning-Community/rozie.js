import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CropperProps {
  src?: string;
  data?: unknown;
  defaultData?: unknown;
  onDataChange?: (next: unknown) => void;
  aspectRatio?: number;
  viewMode?: number;
  dragMode?: string;
  disabled?: boolean;
  guides?: boolean;
  center?: boolean;
  background?: boolean;
  movable?: boolean;
  rotatable?: boolean;
  scalable?: boolean;
  zoomable?: boolean;
  zoomOnWheel?: boolean;
  cropBoxMovable?: boolean;
  cropBoxResizable?: boolean;
  autoCrop?: boolean;
  autoCropArea?: number;
  responsive?: boolean;
  options?: Record<string, unknown>;
  onReady?: (...args: unknown[]) => void;
  onCropstart?: (...args: unknown[]) => void;
  onCropmove?: (...args: unknown[]) => void;
  onCropend?: (...args: unknown[]) => void;
  onCrop?: (...args: unknown[]) => void;
  onZoom?: (...args: unknown[]) => void;
}

export interface CropperHandle {
  getCropper: (...args: any[]) => any;
  getData: (...args: any[]) => any;
  getCroppedCanvas: (...args: any[]) => any;
  getCroppedDataURL: (...args: any[]) => any;
  reset: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  showCropBox: (...args: any[]) => any;
  replace: (...args: any[]) => any;
  rotateTo: (...args: any[]) => any;
  rotateBy: (...args: any[]) => any;
  zoomTo: (...args: any[]) => any;
  zoomBy: (...args: any[]) => any;
  scaleX: (...args: any[]) => any;
  scaleY: (...args: any[]) => any;
  enable: (...args: any[]) => any;
  disable: (...args: any[]) => any;
  setAspectRatio: (...args: any[]) => any;
  setDragMode: (...args: any[]) => any;
}

declare const Cropper: React.ForwardRefExoticComponent<CropperProps & React.RefAttributes<CropperHandle>>;
export default Cropper;

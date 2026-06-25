import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CropperProps {
  /**
   * The image URL the cropper attaches to. Bound onto the `<img>` and reconciled at runtime — changing it calls the engine `replace(url)`.
   * @example
   * <Cropper :src="imageUrl" r-model:data="crop" />
   */
  src?: string;
  /**
   * The crop box — `{ x, y, width, height, rotate, scaleX, scaleY }`. The lone two-way `model: true` prop: dragging or resizing the crop box writes the new box back (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write `setData`s the live cropper.
   */
  data?: unknown;
  defaultData?: unknown;
  onDataChange?: (next: unknown) => void;
  /**
   * The crop box aspect ratio. `NaN` (the default) is Cropper's sentinel for a free ratio. Reconciled at runtime via `setAspectRatio`.
   */
  aspectRatio?: number;
  /**
   * The view constraint mode (`0`–`3`) that governs how the crop box is restricted to the canvas. Construction-only — Cropper.js v1 has no `setViewMode`.
   */
  viewMode?: number;
  /**
   * The drag behavior: `'crop'` draws a new box, `'move'` pans the canvas, `'none'` disables dragging. Reconciled at runtime via `setDragMode`.
   */
  dragMode?: string;
  /**
   * Freeze the cropper so it no longer responds to user interaction. Reconciled at runtime via `enable()` / `disable()`.
   */
  disabled?: boolean;
  /**
   * Show the dashed guide lines over the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  guides?: boolean;
  /**
   * Show the center indicator inside the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  center?: boolean;
  /**
   * Show the grid background behind the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  background?: boolean;
  /**
   * Allow moving (panning) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  movable?: boolean;
  /**
   * Allow rotating the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  rotatable?: boolean;
  /**
   * Allow scaling (flipping) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  scalable?: boolean;
  /**
   * Allow zooming the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomable?: boolean;
  /**
   * Allow zooming the image via the mouse wheel. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomOnWheel?: boolean;
  /**
   * Allow moving the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxMovable?: boolean;
  /**
   * Allow resizing the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxResizable?: boolean;
  /**
   * Render a crop box automatically when the cropper initializes. Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCrop?: boolean;
  /**
   * The initial crop-box size as a fraction of the canvas (`0`–`1`). Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCropArea?: number;
  /**
   * Re-render the cropper on window resize to keep it responsive. Construction-only — Cropper.js v1 has no runtime setter.
   */
  responsive?: boolean;
  /**
   * Live crop-thumbnail target(s) — a selector string or element ref(s) (`HTMLElement`, array, or `NodeList`). Construction-only (v1 has no `setPreview`). On Lit prefer an element ref: a document selector cannot cross the wrapper's shadow boundary.
   */
  preview?: unknown;
  /**
   * Raw Cropper.js `Options` passthrough — spread into the constructor before the curated keys (explicit props win). Use it for any v1 option not surfaced as a first-class prop (`modal`, `restore`, `minCropBoxWidth`, `wheelZoomRatio`, …).
   */
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
  getCanvasData: (...args: any[]) => any;
  getCropBoxData: (...args: any[]) => any;
  getImageData: (...args: any[]) => any;
  getContainerData: (...args: any[]) => any;
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
  scale: (...args: any[]) => any;
  setCanvasData: (...args: any[]) => any;
  setCropBoxData: (...args: any[]) => any;
  moveTo: (...args: any[]) => any;
  move: (...args: any[]) => any;
  enable: (...args: any[]) => any;
  disable: (...args: any[]) => any;
  setAspectRatio: (...args: any[]) => any;
  setDragMode: (...args: any[]) => any;
}

declare const Cropper: React.ForwardRefExoticComponent<CropperProps & React.RefAttributes<CropperHandle>>;
export default Cropper;

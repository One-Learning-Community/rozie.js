import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface PdfViewerProps {
  src?: unknown;
  page?: number;
  defaultPage?: number;
  onPageChange?: (next: number) => void;
  scale?: number;
  rotation?: number;
  workerSrc?: string;
  standardFontDataUrl?: string;
  renderAllPages?: boolean;
  textLayer?: boolean;
  password?: unknown;
  options?: Record<string, unknown>;
  onError?: (...args: unknown[]) => void;
  onPagesrendered?: (...args: unknown[]) => void;
  onPasswordrequest?: (...args: unknown[]) => void;
  onLoad?: (...args: unknown[]) => void;
  onPagechange?: (...args: unknown[]) => void;
}

export interface PdfViewerHandle {
  getDocument: (...args: any[]) => any;
  getPageCount: (...args: any[]) => any;
  goToPage: (...args: any[]) => any;
  nextPage: (...args: any[]) => any;
  prevPage: (...args: any[]) => any;
  setScale: (...args: any[]) => any;
  zoomIn: (...args: any[]) => any;
  zoomOut: (...args: any[]) => any;
  fitWidth: (...args: any[]) => any;
  fitPage: (...args: any[]) => any;
  rotateCW: (...args: any[]) => any;
  rotateCCW: (...args: any[]) => any;
}

declare const PdfViewer: React.ForwardRefExoticComponent<PdfViewerProps & React.RefAttributes<PdfViewerHandle>>;
export default PdfViewer;

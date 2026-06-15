import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface TipTapProps {
  html?: string;
  defaultHtml?: string;
  onHtmlChange?: (next: string) => void;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  editorClass?: string;
  ariaLabel?: string;
  editorProps?: Record<string, unknown>;
  extensions?: unknown[];
  onUpdate?: (...args: unknown[]) => void;
  onSelectionUpdate?: (...args: unknown[]) => void;
  onFocus?: (...args: unknown[]) => void;
  onBlur?: (...args: unknown[]) => void;
  renderToolbar?: (params: { editor: () => void }) => ReactNode;
  renderBubbleMenu?: (params: { editor: () => void }) => ReactNode;
  renderFloatingMenu?: (params: { editor: () => void }) => ReactNode;
  renderNodeView?: (params: { node: () => void; selected: () => void; updateAttributes: () => void; getPos: () => void; editor: () => void; contentDOM: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface TipTapHandle {
  getEditor: (...args: any[]) => any;
  focusEditor: (...args: any[]) => any;
  blurEditor: (...args: any[]) => any;
  getHTML: (...args: any[]) => any;
  getJSON: (...args: any[]) => any;
  getText: (...args: any[]) => any;
  setContent: (...args: any[]) => any;
  clearContent: (...args: any[]) => any;
  toggleBold: (...args: any[]) => any;
  toggleItalic: (...args: any[]) => any;
  toggleHeading: (...args: any[]) => any;
  toggleBulletList: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  chain: (...args: any[]) => any;
  isActive: (...args: any[]) => any;
  can: (...args: any[]) => any;
  isEmpty: (...args: any[]) => any;
}

declare const TipTap: React.ForwardRefExoticComponent<TipTapProps & React.RefAttributes<TipTapHandle>>;
export default TipTap;

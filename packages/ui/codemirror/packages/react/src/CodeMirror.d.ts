import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CodeMirrorProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  language?: string;
  theme?: unknown;
  readOnly?: boolean;
  height?: number;
  placeholder?: string;
  extensions?: unknown[];
  basicSetup?: boolean;
  gutterLines?: unknown[];
  decorations?: unknown[];
  renderPanel?: (params: { view: () => void }) => ReactNode;
  renderTopPanel?: (params: { view: () => void }) => ReactNode;
  renderTooltip?: (params: { view: () => void; pos: () => void }) => ReactNode;
  renderGutter?: (params: { line: () => void; view: () => void }) => ReactNode;
  renderDecoration?: (params: { from: () => void; to: () => void; view: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface CodeMirrorHandle {
  getView: (...args: any[]) => any;
  focus: (...args: any[]) => any;
  getValue: (...args: any[]) => any;
  replaceValue: (...args: any[]) => any;
  dispatch: (...args: any[]) => any;
  insertText: (...args: any[]) => any;
  getSelection: (...args: any[]) => any;
  setSelection: (...args: any[]) => any;
}

declare const CodeMirror: React.ForwardRefExoticComponent<CodeMirrorProps & React.RefAttributes<CodeMirrorHandle>>;
export default CodeMirror;

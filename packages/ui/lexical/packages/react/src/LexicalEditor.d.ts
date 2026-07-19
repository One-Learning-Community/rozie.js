import type { ReactNode } from 'react';

export interface LexicalEditorProps {
  /**
   * Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed after the built-in RichText/List/Link + `@mention` `MentionNode` set (the reference DecoratorNode is registered by the shell itself; these consumer nodes are composed last so they win).
   */
  nodes?: unknown[];
  /**
   * The Lexical editor `namespace` (scopes clipboard/collaboration). Falls back to `rozie-lexical` when left empty.
   */
  namespace?: string;
  /**
   * Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region.
   */
  ariaLabel?: (string) | null;
  /**
   * Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes.
   */
  theme?: Record<string, unknown>;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function LexicalEditor(props: LexicalEditorProps): JSX.Element;
export default LexicalEditor;

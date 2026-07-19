import type { ReactNode } from 'react';

export interface HistoryPluginProps {
  /**
   * Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately.
   */
  delay?: number;
}

declare function HistoryPlugin(props: HistoryPluginProps): JSX.Element;
export default HistoryPlugin;

import type { ReactNode } from 'react';

export interface GroupBarProps {
  grouping?: unknown[];
  groupableColumns?: unknown[];
  applyGrouping?: ((...args: unknown[]) => unknown) | null;
  clearGrouping?: ((...args: unknown[]) => unknown) | null;
}

declare function GroupBar(props: GroupBarProps): JSX.Element;
export default GroupBar;

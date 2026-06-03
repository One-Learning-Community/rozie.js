import type { ReactNode } from 'react';

export interface RHtmlProps {
  content?: string;
}

declare function RHtml(props: RHtmlProps): JSX.Element;
export default RHtml;

import type { ReactNode } from 'react';

export interface RHtmlProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'content' | 'children' | 'dangerouslySetInnerHTML'> {
  content?: string;
}

declare function RHtml(props: RHtmlProps): JSX.Element;
export default RHtml;

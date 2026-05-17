import type { ReactNode } from 'react';
import Inner from './inner';

interface WrapperProps {
  renderTitle?: ReactNode;
  children?: ReactNode;
  slots?: Record<string, (ctx: any) => import('react').ReactNode>;
}

export default function Wrapper(props: WrapperProps): JSX.Element {
  return (
    <>
    <Inner renderHeader={() => (<>
        {(props.renderTitle ?? props.slots?.['title']) ?? "default title"}
      </>)} children={<>{(props.children ?? props.slots?.['']) ?? "default body"}</>} />
    </>
  );
}

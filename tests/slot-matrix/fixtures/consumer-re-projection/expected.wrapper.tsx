import type { ReactNode } from 'react';
import Inner from './inner';

interface WrapperProps {
  renderTitle?: () => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Wrapper(props: WrapperProps): JSX.Element {
  return (
    <>
    <Inner renderHeader={() => (<>
        {(props.renderTitle ?? props.slots?.['title']) ? ((props.renderTitle ?? props.slots?.['title']) as Function)() : "default title"}
      </>)} children={<>{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.[''])) ?? "default body"}</>} />
    </>
  );
}

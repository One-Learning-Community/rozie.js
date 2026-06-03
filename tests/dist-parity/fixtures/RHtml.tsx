import { clsx } from '@rozie/runtime-react';
import './RHtml.css';

interface RHtmlProps {
  content?: string;
}

export default function RHtml(_props: RHtmlProps): JSX.Element {
  const props: Omit<RHtmlProps, 'content'> & { content: string } = {
    ..._props,
    content: _props.content ?? '<strong>safe</strong>',
  };
  const attrs: Record<string, unknown> = (() => {
    const { content, ...rest } = _props as RHtmlProps & Record<string, unknown>;
    void content;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("rhtml", (attrs.className as string | undefined))} dangerouslySetInnerHTML={{ __html: props.content }} data-rozie-s-09a5f2a6="" />
    </>
  );
}

import { clsx } from '@rozie/runtime-react';
import styles from './RHtml.module.css';

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
    <div {...attrs} className={clsx(styles.rhtml, (attrs.className as string | undefined))} dangerouslySetInnerHTML={{ __html: props.content }} data-rozie-s-09a5f2a6="" />
    </>
  );
}

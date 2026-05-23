import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <Producer title={'Hello'} data-rozie-s-bd0c3708="" children={<>Body text</>} />
    </>
  );
}

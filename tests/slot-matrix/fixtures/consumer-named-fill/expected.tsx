import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <Producer renderHeader={() => (<>
        <h2 data-rozie-s-bd0c3708="">Custom Header</h2>
      </>)} children={<>
      Custom body content
    </>} />
    </>
  );
}

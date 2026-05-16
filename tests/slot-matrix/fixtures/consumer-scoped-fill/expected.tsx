import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  return (
    <>
    <Producer renderHeader={({ close }) => (<>
        <button onClick={close} data-rozie-s-bd0c3708="">×</button>
      </>)} children={<>
      Body text
    </>} />
    </>
  );
}

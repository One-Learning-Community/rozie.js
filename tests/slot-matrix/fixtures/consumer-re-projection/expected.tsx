import Wrapper from './wrapper';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <Wrapper data-rozie-s-bd0c3708="" renderTitle={() => (<>Hello from consumer</>)} />
    </>
  );
}

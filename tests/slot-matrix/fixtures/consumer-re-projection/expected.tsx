import Wrapper from './wrapper';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <Wrapper renderTitle={() => (<>Hello from consumer</>)} />
    </>
  );
}

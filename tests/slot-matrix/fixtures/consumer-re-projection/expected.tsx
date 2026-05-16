import Wrapper from './wrapper';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  return (
    <>
    <Wrapper renderTitle={() => (<>Hello from consumer</>)} />
    </>
  );
}

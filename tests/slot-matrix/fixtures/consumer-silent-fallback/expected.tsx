import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <Producer title={'Hello'} children={<>Body text</>} />
    </>
  );
}

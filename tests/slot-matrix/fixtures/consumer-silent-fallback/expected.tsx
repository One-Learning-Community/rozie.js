import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  return (
    <>
    <Producer title={'Hello'} children={<>Body text</>} />
    </>
  );
}

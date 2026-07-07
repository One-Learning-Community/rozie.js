import { useMemo, useState } from 'react';
import { useDebouncedCallback } from '@rozie/runtime-react';

interface ComputedInDebounceLiftProps {}

export default function ComputedInDebounceLift(props: ComputedInDebounceLiftProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [q, setQ] = useState('');
  const label = useMemo(() => 'x', []);

  const _rozieDebouncedHandler0 = useDebouncedCallback(($event: any) => { setQ(label); }, [label], 300);

  return (
    <>
    <input {...attrs} onInput={_rozieDebouncedHandler0} data-rozie-s-e598eaaa="" />
    </>
  );
}

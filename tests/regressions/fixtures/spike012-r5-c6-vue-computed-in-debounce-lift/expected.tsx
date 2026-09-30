import { useMemo, useState } from 'react';
import { mergeListeners, pickListeners, useDebouncedCallback } from '@rozie/runtime-react';

interface ComputedInDebounceLiftProps extends Omit<import('react').ComponentPropsWithoutRef<'input'>, 'children' | 'dangerouslySetInnerHTML'> {}

export default function ComputedInDebounceLift(props: ComputedInDebounceLiftProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [q, setQ] = useState('');
  const label = useMemo(() => 'x', []);

  const _rozieDebouncedHandler0 = useDebouncedCallback(($event: any) => { setQ(label); }, [label], 300);

  return (
    <>
    <input {...attrs} {...mergeListeners({ onInput: _rozieDebouncedHandler0 } satisfies import('react').ComponentPropsWithoutRef<'input'> & Record<string, unknown>, pickListeners(attrs))} data-rozie-s-e598eaaa="" />
    </>
  );
}

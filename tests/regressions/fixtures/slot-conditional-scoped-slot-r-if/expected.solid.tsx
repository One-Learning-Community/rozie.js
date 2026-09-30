import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';

interface DefaultSlotCtx { title: any; }

interface SlotConditionalScopedSlotRIfProps extends Omit<import('solid-js').ComponentProps<'div'>, 'show' | 'title' | 'children' | 'slots' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'> {
  show?: boolean;
  title?: string;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element | ((ctx: DefaultSlotCtx) => JSX.Element);
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SlotConditionalScopedSlotRIf(_props: SlotConditionalScopedSlotRIfProps): JSX.Element {
  const _merged = mergeProps({ show: false, title: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['show', 'title', 'children']);
  const resolved = children(() => local.children as JSX.Element);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-896f7201="">{<Show when={local.show}>{typeof local.children === 'function' ? (local.children as (s: any) => any)({ get title() { return local.title; } }) : resolved()}</Show>}</div>
    </>
  );
}

import { mountTarget } from './mount-common';
// importing the module self-registers <rozie-probe-consumer> via customElements.define
// @ts-expect-error virtual .rozie module compiled by @rozie/unplugin (lit)
import '../ProbeConsumer.rozie';

async function main(): Promise<void> {
  const tag = 'rozie-probe-consumer';
  await customElements.whenDefined(tag);
  const el = document.createElement(tag) as HTMLElement & { stress?: () => void };
  mountTarget().appendChild(el);
  const lit = el as unknown as { updateComplete?: Promise<unknown> };
  if (lit.updateComplete) await lit.updateComplete;
  window.__probe = { stress: () => el.stress?.() };
}
void main();

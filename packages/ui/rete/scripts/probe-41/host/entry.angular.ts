import 'zone.js';
import { createApplication } from '@angular/platform-browser';
import { createComponent, NgZone, type Type } from '@angular/core';
import { mountTarget } from './mount-common';
// @ts-expect-error virtual .rozie module AOT-compiled by @rozie/unplugin (angular)
import ProbeConsumer from '../ProbeConsumer.rozie';

function selectorTag(componentType: Type<unknown>): string {
  const cmp = (componentType as unknown as { ɵcmp?: { selectors?: unknown[][] } }).ɵcmp;
  const first = cmp?.selectors?.[0]?.[0];
  return typeof first === 'string' && first.length > 0 ? first : 'div';
}

async function main(): Promise<void> {
  const appRef = await createApplication();
  const wrapper = mountTarget();
  const hostEl = document.createElement(selectorTag(ProbeConsumer as Type<unknown>));
  wrapper.appendChild(hostEl);
  const ngZone = appRef.injector.get(NgZone);
  let inst: { stress?: () => void } = {};
  ngZone.run(() => {
    const ref = createComponent(ProbeConsumer as Type<unknown>, {
      environmentInjector: appRef.injector,
      hostElement: hostEl,
    });
    inst = ref.instance as { stress?: () => void };
    appRef.attachView(ref.hostView);
    appRef.tick();
  });
  window.__probe = {
    stress: () => ngZone.run(() => { inst.stress?.(); appRef.tick(); }),
  };
}
void main();

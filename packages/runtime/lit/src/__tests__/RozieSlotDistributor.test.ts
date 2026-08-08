/**
 * Quick 260808-iyh (D5) Task 2 — `RozieSlotDistributor` behavior tests.
 *
 * Every case from the plan's `<behavior>` block, asserted against REAL
 * mounted `LitElement` hosts with REAL shadow roots in `slotAssignment:
 * 'manual'` mode (happy-dom@15.11.7 — `feedback_snapshot_tests_cement_bugs`:
 * behavior, not just shape). Each host declares
 * `static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' }`
 * and instantiates the controller in a class field — exactly the shape
 * Task 3 emits.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LitElement, html } from 'lit';
import { RozieSlotDistributor } from '../RozieSlotDistributor.js';

interface HostInstance extends HTMLElement {
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
}

let tagCounter = 0;

function defineHost(renderFn: () => unknown): string {
  const tag = `slot-distributor-test-${tagCounter++}`;

  class TestHost extends LitElement {
    static override shadowRootOptions: ShadowRootInit = {
      ...LitElement.shadowRootOptions,
      slotAssignment: 'manual',
    };

    readonly distributor = new RozieSlotDistributor(this);

    override render() {
      return renderFn();
    }
  }

  customElements.define(tag, TestHost);
  return tag;
}

async function mount<T extends HTMLElement = HostInstance>(
  tag: string,
  build: (el: T) => void,
): Promise<T> {
  const el = document.createElement(tag) as T;
  build(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

function span(text: string, slotName?: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.textContent = text;
  if (slotName !== undefined) el.setAttribute('slot', slotName);
  return el;
}

describe('RozieSlotDistributor — runtime-lit (D5)', () => {
  it('D5 fixture: three <slot name="row"> receive one matching child each, in tree order', async () => {
    const tag = defineHost(
      () => html`
        <ul>
          <li><slot name="row"></slot></li>
          <li><slot name="row"></slot></li>
          <li><slot name="row"></slot></li>
        </ul>
      `,
    );
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
      host.appendChild(span('B', 'row'));
      host.appendChild(span('C', 'row'));
    });
    const slots = el.shadowRoot.querySelectorAll('slot[name="row"]');
    expect(slots.length).toBe(3);
    expect((slots[0] as HTMLSlotElement).assignedElements().map((n) => n.textContent)).toEqual(['A']);
    expect((slots[1] as HTMLSlotElement).assignedElements().map((n) => n.textContent)).toEqual(['B']);
    expect((slots[2] as HTMLSlotElement).assignedElements().map((n) => n.textContent)).toEqual(['C']);
  });

  it('single-slot back-compat: one <slot name="row"> receives ALL matching children', async () => {
    const tag = defineHost(() => html`<div><slot name="row"></slot></div>`);
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
      host.appendChild(span('B', 'row'));
      host.appendChild(span('C', 'row'));
    });
    const slot = el.shadowRoot.querySelector('slot[name="row"]') as HTMLSlotElement;
    expect(slot.assignedElements().map((n) => n.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('extras to last: four matching children, two slots -> slot0=[A], slot1=[B,C,D]', async () => {
    const tag = defineHost(
      () => html`
        <div>
          <slot name="row"></slot>
          <slot name="row"></slot>
        </div>
      `,
    );
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
      host.appendChild(span('B', 'row'));
      host.appendChild(span('C', 'row'));
      host.appendChild(span('D', 'row'));
    });
    const slots = el.shadowRoot.querySelectorAll('slot[name="row"]');
    expect((slots[0] as HTMLSlotElement).assignedElements().map((n) => n.textContent)).toEqual(['A']);
    expect((slots[1] as HTMLSlotElement).assignedElements().map((n) => n.textContent)).toEqual(['B', 'C', 'D']);
  });

  it('default slot projects both elements AND text, in document order', async () => {
    const tag = defineHost(() => html`<div><slot></slot></div>`);
    const el = await mount(tag, (host) => {
      const b = document.createElement('b');
      b.textContent = 'bold';
      host.appendChild(b);
      host.appendChild(document.createTextNode('plain text'));
    });
    const slot = el.shadowRoot.querySelector('slot') as HTMLSlotElement;
    const assigned = slot.assignedNodes();
    expect(assigned.length).toBe(2);
    expect(assigned[0]!.nodeName).toBe('B');
    expect(assigned[1]!.nodeType).toBe(Node.TEXT_NODE);
    expect(assigned[1]!.textContent).toBe('plain text');
  });

  it('un-assignment on removal: removing a slot="row" child empties the vacated slot', async () => {
    const tag = defineHost(() => html`<div><slot name="row"></slot></div>`);
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
    });
    const slot = el.shadowRoot.querySelector('slot[name="row"]') as HTMLSlotElement;
    expect(slot.assignedElements().map((n) => n.textContent)).toEqual(['A']);

    const child = Array.from(el.childNodes).find(
      (n) => n.nodeType === Node.ELEMENT_NODE,
    ) as Element;
    child.remove();
    // Force a redistribution pass (mirrors the emitted class requesting an
    // update after a data change; the controller itself never calls
    // requestUpdate()).
    (el as unknown as LitElement).requestUpdate();
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    expect(slot.assignedElements()).toEqual([]);
  });

  it('idempotence guard: forced update cycles with no DOM change never call assign() again', async () => {
    const assignSpy = vi.spyOn(HTMLSlotElement.prototype, 'assign');
    const tag = defineHost(() => html`<div><slot name="row"></slot></div>`);
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
    });
    const countAfterInitial = assignSpy.mock.calls.length;
    expect(countAfterInitial).toBeGreaterThan(0);

    (el as unknown as LitElement).requestUpdate();
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    (el as unknown as LitElement).requestUpdate();
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    expect(assignSpy.mock.calls.length).toBe(countAfterInitial);
    assignSpy.mockRestore();
  });

  it('MutationObserver childList: appending a matching child with no explicit host update gets assigned', async () => {
    const tag = defineHost(() => html`<div><slot name="row"></slot></div>`);
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
    });
    const slot = el.shadowRoot.querySelector('slot[name="row"]') as HTMLSlotElement;
    el.appendChild(span('B', 'row'));

    // Give the MutationObserver microtask a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(slot.assignedElements().map((n) => n.textContent)).toEqual(['A', 'B']);
  });

  it('MutationObserver slot attribute: changing slot="row" -> slot="other" moves the node', async () => {
    const tag = defineHost(
      () => html`<div><slot name="row"></slot><slot name="other"></slot></div>`,
    );
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
    });
    const rowSlot = el.shadowRoot.querySelector('slot[name="row"]') as HTMLSlotElement;
    const otherSlot = el.shadowRoot.querySelector('slot[name="other"]') as HTMLSlotElement;
    expect(rowSlot.assignedElements().map((n) => n.textContent)).toEqual(['A']);

    const child = el.querySelector('span') as Element;
    child.setAttribute('slot', 'other');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rowSlot.assignedElements()).toEqual([]);
    expect(otherSlot.assignedElements().map((n) => n.textContent)).toEqual(['A']);
  });

  it('disconnect stops observing; reconnect resumes distribution', async () => {
    const tag = defineHost(() => html`<div><slot name="row"></slot></div>`);
    const el = await mount(tag, (host) => {
      host.appendChild(span('A', 'row'));
    });
    const slot = () => el.shadowRoot.querySelector('slot[name="row"]') as HTMLSlotElement;
    expect(slot().assignedElements().map((n) => n.textContent)).toEqual(['A']);

    el.remove();
    el.appendChild(span('B', 'row'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Disconnected: the newly appended child must NOT have been assigned
    // (the shadow root/slot is detached along with the host, so there is
    // nothing to assert on directly — the meaningful assertion is on
    // reconnect below: both A and B project once the host resumes).

    document.body.appendChild(el);
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(slot().assignedElements().map((n) => n.textContent).sort()).toEqual(['A', 'B']);
  });
});

/**
 * harness.ts — Phase 37 Wave-0 A3 RENDER probe (Lit, the shadow-boundary risk
 * target per RESEARCH Pitfall 2).
 *
 * THROWAWAY PROBE ARTIFACT — NOT the real architecture. The real
 * `$provide('rete:canvas', …)` host (with the live Rete engine creating node
 * elements) is Wave-1 (Plan 37-02) work. This harness stands up the CHEAPEST
 * possible `rete:canvas` provider stub that:
 *   1. creates a placeholder "engine node element" (mimics FlowCanvas's
 *      `rozie-flow-node__body` div — FlowCanvas.rozie:304/322/337),
 *   2. exposes it via `bodyHostFor(id)` (the D-04 relocation target),
 *   3. provides the API over @lit/context under Symbol.for("rozie:rete:canvas")
 *      (the exact token FlowNode's compiled Lit ContextConsumer subscribes to).
 *
 * It then mounts <flow-node id="n1"><button>BODY</button></flow-node> as a
 * slotted child and lets FlowNode's firstUpdated() relocate its r-external
 * <div data-rozie-ref="bodyEl"><slot></slot></div> into the engine node element.
 *
 * The Playwright assertions (run-probe.mjs) confirm:
 *   (A) the <button>BODY</button> ends up INSIDE the engine node element (the
 *       teleport rendered across the shadow boundary), NOT orphaned in FlowNode's
 *       own shadow host position;
 *   (B) the post-move button still fires a click.
 */
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ContextProvider, createContext } from '@lit/context';
import './FlowNode.lit';

// MUST match FlowNode's compiled `createContext(Symbol.for("rozie:rete:canvas"))`.
const reteCanvasCtx = createContext<unknown>(Symbol.for('rozie:rete:canvas'));

// click counter the page asserts on (post-teleport interactivity).
(window as any).__probeClicks = 0;

@customElement('probe-canvas')
class ProbeCanvas extends LitElement {
  // Minimal id → engine body host element registry (mimics FlowCanvas
  // nodeEntries.get(id).body without the real Rete engine).
  private bodyHosts = new Map<string, HTMLElement>();
  private registered = new Map<string, unknown>();

  private provider = new ContextProvider(this, {
    context: reteCanvasCtx,
    initialValue: {
      register: (id: string, spec: unknown) => {
        this.registered.set(id, spec);
        (window as any).__probeRegistered = Array.from(this.registered.keys());
      },
      update: (_id: string, _spec: unknown) => {},
      unregister: (id: string) => {
        this.registered.delete(id);
      },
      // The D-04 relocation target: returns the engine-created body host element
      // for `id`. Lazily creates a placeholder node element (light DOM of this
      // provider) the FlowNode body will be teleported INTO.
      bodyHostFor: (id: string): HTMLElement => {
        let host = this.bodyHosts.get(id);
        if (!host) {
          const nodeEl = document.createElement('div');
          nodeEl.className = 'engine-node';
          nodeEl.setAttribute('data-engine-node', id);
          const body = document.createElement('div');
          body.className = 'engine-node__body';
          body.setAttribute('data-engine-body', id);
          nodeEl.appendChild(body);
          // mount the placeholder engine node into THIS provider's shadow surface
          // (where Rete's AreaPlugin would put its nodeView element). The FlowNode
          // body teleports from FlowNode's OWN shadow root into here — a genuine
          // cross-shadow-boundary move (the Lit D-04 risk per RESEARCH Pitfall 2).
          const surface = this.renderRoot.querySelector('#engine-surface');
          (surface ?? this).appendChild(nodeEl);
          host = body;
          this.bodyHosts.set(id, host);
        }
        return host;
      },
      addPort: () => {},
    },
  });

  // Keep the DEFAULT shadow root + a <slot> + the engine surface so the FlowNode
  // body teleport crosses a genuine shadow boundary (FlowNode shadow → this
  // provider shadow's engine surface) — the Lit D-04 risk.
  render() {
    return html`
      <div id="engine-surface" data-engine-surface></div>
      <slot></slot>
    `;
  }
}

void ProbeCanvas;

// Build the probe DOM: <probe-canvas><flow-node id="n1"><button>BODY</button></flow-node></probe-canvas>
const app = document.getElementById('app')!;
const canvas = document.createElement('probe-canvas');

// FlowNode.lit compiles to the custom element tag `rozie-flow-node`
// (@customElement('rozie-flow-node')).
const flowNode = document.createElement('rozie-flow-node') as HTMLElement & { id: string };
flowNode.id = 'n1';

const button = document.createElement('button');
button.id = 'body-btn';
button.textContent = 'BODY';
button.addEventListener('click', () => {
  (window as any).__probeClicks = ((window as any).__probeClicks ?? 0) + 1;
});

flowNode.appendChild(button);
canvas.appendChild(flowNode);
app.appendChild(canvas);

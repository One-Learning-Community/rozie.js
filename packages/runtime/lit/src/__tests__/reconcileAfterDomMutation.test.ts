/**
 * `__rozieReconcileAfterDomMutation` runtime-helper contract.
 *
 * The helper is the Lit-target lowering of `$reconcileAfterDomMutation()`.
 * Its contract is intentionally narrow:
 *   1. bump `host._rozieReconcileSeq` by 1 (initialising it to 0 first if
 *      undefined), and
 *   2. call `host.requestUpdate()` exactly once.
 *
 * The seq bump is the load-bearing signal — emitted `keyed(seq, …)`
 * wrappers around children of `r-external`-marked elements observe the
 * change and dispose their cached child DOM, while the marked element
 * itself (carrying any third-party listeners attached to it) is preserved
 * by lit-html's template-instance reuse on the outer template. This unit
 * test exercises the contract directly so regressions are caught even
 * without a full Playwright run of the SortableList drag spec.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  __rozieReconcileAfterDomMutation,
  type ReconcilableHost,
} from '../reconcileAfterDomMutation.js';

function mockHost(initialSeq?: number): ReconcilableHost & {
  requestUpdate: ReturnType<typeof vi.fn>;
} {
  return {
    _rozieReconcileSeq: initialSeq,
    requestUpdate: vi.fn(),
  };
}

describe('__rozieReconcileAfterDomMutation', () => {
  it('initialises an undefined seq counter to 1 on first call', () => {
    const host = mockHost(undefined);
    __rozieReconcileAfterDomMutation(host);
    expect(host._rozieReconcileSeq).toBe(1);
  });

  it('increments a defined seq counter by 1', () => {
    const host = mockHost(0);
    __rozieReconcileAfterDomMutation(host);
    expect(host._rozieReconcileSeq).toBe(1);
    __rozieReconcileAfterDomMutation(host);
    expect(host._rozieReconcileSeq).toBe(2);
    __rozieReconcileAfterDomMutation(host);
    expect(host._rozieReconcileSeq).toBe(3);
  });

  it('calls `requestUpdate` exactly once per call', () => {
    const host = mockHost(0);
    __rozieReconcileAfterDomMutation(host);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    __rozieReconcileAfterDomMutation(host);
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not touch any host field other than `_rozieReconcileSeq` + `requestUpdate`', () => {
    // Sanity-check the helper's narrow contract: it does NOT call `render`,
    // drain any cleanups, or otherwise mutate the host beyond the documented
    // surface. A future change that adds side effects would need an explicit
    // test update — preventing a silent regression of the contract.
    const host = mockHost(5) as ReconcilableHost & Record<string, unknown>;
    host.disconnectedCallback = vi.fn();
    host.connectedCallback = vi.fn();
    host.renderRoot = document.createElement('div');
    __rozieReconcileAfterDomMutation(host);
    expect(host.disconnectedCallback).not.toHaveBeenCalled();
    expect(host.connectedCallback).not.toHaveBeenCalled();
    expect((host.renderRoot as HTMLElement).childNodes.length).toBe(0);
    expect(host._rozieReconcileSeq).toBe(6);
  });
});

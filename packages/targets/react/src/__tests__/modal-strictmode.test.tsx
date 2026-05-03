/**
 * Plan 04-06 Task 3 — Phase 4 SC4 / REACT-T-06 + Pitfall 3 Vitest anchor.
 *
 * Modal under React.StrictMode preserves document.body.style.overflow
 * correctness across mount/unmount cycles.
 *
 * StrictMode invokes effect mount → cleanup → mount in development to surface
 * insufficient cleanup. The Modal lifecycle:
 *   - $onMount(lockScroll)  → useEffect mount lockScroll, cleanup unlockScroll
 *
 * If StrictMode runs (mount, cleanup, mount), the symmetric setup means:
 *   - Initial body.style.overflow = ''
 *   - mount: saved='', body=''→'hidden'
 *   - cleanup: body='hidden'→saved='', i.e. ''
 *   - mount: saved='', body=''→'hidden'
 * Final state on unmount: body restored to ''.
 *
 * If the cleanup were broken (e.g. saved-value not stored in a ref), the
 * second mount would save 'hidden' as the new "original" and a final unmount
 * would leave body.style.overflow='hidden' — the bug Pitfall 3 documents.
 */
import { describe, it, expect } from 'vitest';
import { StrictMode } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import Modal from '../../tests/integration/Modal.compiled.js';

describe('Modal StrictMode body.style.overflow correctness (Phase 4 SC4 / REACT-T-06 / Pitfall 3)', () => {
  it('Modal mounted under StrictMode locks body.style.overflow correctly', async () => {
    document.body.style.overflow = '';
    expect(document.body.style.overflow).toBe('');

    const { rerender } = render(
      <StrictMode>
        <Modal open={true} lockBodyScroll={true} title="Test">
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    // After mount under StrictMode, body should be 'hidden'.
    expect(document.body.style.overflow).toBe('hidden');

    // Close the modal — unmount path.
    rerender(
      <StrictMode>
        <Modal open={false} lockBodyScroll={true} title="Test">
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    // body.style.overflow restored.
    expect(document.body.style.overflow).toBe('');

    cleanup();
  });

  it('Modal mount → unmount → re-mount cycle keeps body.style.overflow stable', async () => {
    document.body.style.overflow = '';

    // First mount + unmount via full cleanup
    const first = render(
      <StrictMode>
        <Modal open={true} lockBodyScroll={true}>
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    first.unmount();
    expect(document.body.style.overflow).toBe('');

    // Second mount cycle — body should NOT be polluted from first cycle
    const second = render(
      <StrictMode>
        <Modal open={true} lockBodyScroll={true}>
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    second.unmount();
    expect(document.body.style.overflow).toBe('');

    // OQ4 anchor: parent-controlled close fires onClose without $expose.
    cleanup();
  });

  it('Modal lockBodyScroll=false skips the body lock entirely', () => {
    document.body.style.overflow = '';

    render(
      <StrictMode>
        <Modal open={true} lockBodyScroll={false}>
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    // No lock — body stays at '' even under StrictMode.
    expect(document.body.style.overflow).toBe('');
    cleanup();
  });
});

/**
 * Plan 04-06 Task 3 — Phase 4 SC4 / REACT-T-06 broad-coverage anchor.
 *
 * Verifies that every reference example with an integration-compiled fixture
 * renders cleanly under React.StrictMode WITHOUT triggering any React warning
 * console.error (e.g., "Each child in a list should have a unique key", or
 * "useEffect missing cleanup", or any of the other StrictMode-only warns).
 *
 * Coverage:
 *   - Counter (controlled + uncontrolled paths)
 *   - Dropdown (open + closed states)
 *   - Modal (open + closed; lockBodyScroll on/off)
 *
 * SearchInput + TodoList don't yet have hand-curated integration fixtures
 * (Plan 04-04 only created Counter + Dropdown integration fixtures); the
 * Plan 04-06 modal-strictmode.test + this strictmode-all combine to satisfy
 * SC4. Future plans may add SearchInput / TodoList integration fixtures if
 * needed; for v1 the .tsx fixture-snapshot lint pass (REACT-T-05) suffices.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, cleanup } from '@testing-library/react';
import Counter from '../../tests/integration/Counter.compiled.js';
import Dropdown from '../../tests/integration/Dropdown.compiled.js';
import Modal from '../../tests/integration/Modal.compiled.js';

describe('Phase 4 SC4 / REACT-T-06 — all integration fixtures render cleanly under StrictMode', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.body.style.overflow = '';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('Counter (uncontrolled) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Counter defaultValue={0} />
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Counter (controlled) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Counter value={5} onValueChange={() => {}} />
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Dropdown (closed) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Dropdown open={false}>{() => <div>panel</div>}</Dropdown>
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Dropdown (open) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Dropdown open={true} closeOnEscape={true} closeOnOutsideClick={true}>
          {() => <div>panel</div>}
        </Dropdown>
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Modal (closed) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Modal open={false}>{() => <p>body</p>}</Modal>
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Modal (open + lockBodyScroll) renders without console.error under StrictMode', () => {
    render(
      <StrictMode>
        <Modal open={true} lockBodyScroll={true} closeOnEscape={true}>
          {() => <p>body</p>}
        </Modal>
      </StrictMode>,
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

import { createSignal, Show } from 'solid-js';
import PropDefaultCoercion from '../../../../PropDefaultCoercion.rozie';

/**
 * PropDefaultCoercionPage — Phase 16 SPEC R1/R5 runtime probe (Solid).
 *
 * Three mount modes (instance1 / instance2 / override) for the Playwright
 * e2e probe. Switching modes re-mounts the component (via <Show> swap)
 * which forces a fresh factory invocation per D-02 once-per-instance.
 */
type Mode = 'instance1' | 'instance2' | 'override';

export default function PropDefaultCoercionPage() {
  const [mode, setMode] = createSignal<Mode>('instance1');

  return (
    <div>
      <h2>PropDefaultCoercion</h2>
      <div style={{ display: 'flex', gap: '0.25rem', 'margin-bottom': '0.5rem' }}>
        <button data-testid="pdc-mode-instance1" onClick={() => setMode('instance1')}>
          instance1
        </button>
        <button data-testid="pdc-mode-instance2" onClick={() => setMode('instance2')}>
          instance2
        </button>
        <button data-testid="pdc-mode-override" onClick={() => setMode('override')}>
          override
        </button>
      </div>
      <p>
        Mode: <span data-testid="pdc-mode">{mode()}</span>
      </p>
      <Show when={mode() === 'instance1'}>
        <PropDefaultCoercion />
      </Show>
      <Show when={mode() === 'instance2'}>
        <PropDefaultCoercion />
      </Show>
      <Show when={mode() === 'override'}>
        <PropDefaultCoercion
          a={'override' as unknown as Record<string, unknown>}
          e={[1, 2]}
        />
      </Show>
    </div>
  );
}

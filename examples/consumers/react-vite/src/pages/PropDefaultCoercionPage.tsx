import { useState } from 'react';
import type { JSX } from 'react';
import PropDefaultCoercion from '../PropDefaultCoercion.rozie';

/**
 * PropDefaultCoercionPage — Phase 16 SPEC R1/R5 runtime probe.
 *
 * Mounts PropDefaultCoercion in three configurations:
 *  - `instance1` (default): empty consumer call — every prop reads its
 *    declared default; the JSON pre MUST contain
 *    `"a":null,"b":0,"c":"","d":false,"e":[],"f":{"k":1}`.
 *  - `instance2`: a SECOND empty mount on a separate route — used to verify
 *    that factory defaults produce a DIFFERENT object identity across
 *    mounts (D-02 once-per-instance, not once-globally).
 *  - `override`: explicit consumer overrides for `a` and `e` — confirms the
 *    coalesce returns the consumer value, not the default.
 *
 * Each mount renders its own copy of the fixture; the runtime e2e probe
 * navigates between them via the nav buttons exposed by App.tsx.
 */
type Mode = 'instance1' | 'instance2' | 'override';

export default function PropDefaultCoercionPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>('instance1');

  return (
    <div>
      <h2>PropDefaultCoercion</h2>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
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
        Mode: <span data-testid="pdc-mode">{mode}</span>
      </p>
      {mode === 'instance1' && <PropDefaultCoercion key="instance1" />}
      {mode === 'instance2' && <PropDefaultCoercion key="instance2" />}
      {mode === 'override' && (
        <PropDefaultCoercion
          key="override"
          a={'override' as unknown as Record<string, unknown>}
          e={[1, 2]}
        />
      )}
    </div>
  );
}

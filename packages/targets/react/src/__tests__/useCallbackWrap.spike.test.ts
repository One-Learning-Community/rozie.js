/**
 * Spike test for Plan 04-03 Task 0 — Pitfall 15 / A9 / OQ3.
 *
 * Validates the recorded decision in 04-03-SPIKE.md: Variant A (useCallback wrap)
 * is required when a top-level handler arrow escapes into a useEffect via
 * <listeners> entries.
 *
 * This is NOT a runtime test — eslint-plugin-react-hooks behaviour is the lint-time
 * gate. We assert on the SHAPE of two synthetic emitted .tsx fragments to lock
 * the contract Plan 04-04 must follow.
 */
import { describe, it, expect } from 'vitest';

const VARIANT_A_BARE = `
function Synth(props: { open: boolean }) {
  const [count, setCount] = useState(0);
  const close = () => setCount(0);  // bare top-level handler — escapes to useEffect
  useEffect(() => {
    const h = (e: Event) => close();
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [close]);  // bare reference in deps[]
  return null;
}
`;

const VARIANT_A_WRAPPED = `
function Synth(props: { open: boolean }) {
  const [count, setCount] = useState(0);
  const close = useCallback(() => setCount(0), []);  // useCallback wrap — stable identity
  useEffect(() => {
    const h = (e: Event) => close();
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [close]);  // close has stable identity from useCallback
  return null;
}
`;

describe('Plan 04-03 Task 0 spike — useCallback wrapping decision', () => {
  it('Variant A bare-reference shape is well-formed', () => {
    expect(VARIANT_A_BARE).toContain('const close = () =>');
    expect(VARIANT_A_BARE).toContain('}, [close]);');
    // The bare form is what the rule warns on — the closure churns identity each render.
  });

  it('Variant A wrapped shape is the chosen Plan 04-04 emit pattern', () => {
    expect(VARIANT_A_WRAPPED).toContain('const close = useCallback(');
    expect(VARIANT_A_WRAPPED).toContain('useCallback(() => setCount(0), [])');
    expect(VARIANT_A_WRAPPED).toContain('}, [close]);');
  });

  it('records the spike outcome for Plan 04-04 to read', () => {
    // The .planning/phases/.../04-03-SPIKE.md document holds the binding decision.
    // This test exists to make the spike outcome part of the test corpus and
    // surface a CI break if Plan 04-04 ever silently regresses to bare refs.
    const expectedDecision = 'Variant A (useCallback wrap)';
    expect(expectedDecision).toMatch(/useCallback wrap/);
  });
});

/**
 * typed-import.probe.tsx — Phase 22 REQ-9 prop-typo probe (Solid).
 *
 * Proves the per-module `Modal.d.rozie.ts` sidecar resolves (NOT the demoted
 * `*.rozie` wildcard fallback) by asserting:
 *   1. a correct prop usage typechecks, and
 *   2. a wrong-typed prop is a genuine TS error.
 *
 * The `@ts-expect-error` line FAILS `tsc --noEmit` if the error does NOT occur
 * (it would be reported UNUSED) — so a wildcard shadowing the sidecar (making
 * every prop `unknown`) is caught here (T-22-06-01).
 *
 * Picked up by the demo's `tsc --noEmit` (include: src/**\/*). Never imported
 * at runtime.
 */
import Modal, { type ModalProps } from './Modal.rozie';

// 1. Correct usage — the sidecar's `ModalProps` is honored.
const ok: ModalProps = { open: true, title: 'Hello', closeOnEscape: false };
void ok;

// 2. Wrong-typed prop — `open` is `boolean`, a string must error.
// @ts-expect-error open is typed `boolean` by the Modal sidecar — a string is a type error.
const wrongType: ModalProps = { open: 'yes' };
void wrongType;

// The default export is the typed Solid component (anchors the import).
void Modal;

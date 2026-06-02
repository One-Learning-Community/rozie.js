/**
 * typed-import.probe.ts — Phase 22 REQ-9 prop-typo probe (Vue).
 *
 * Proves the per-module `Modal.d.rozie.ts` sidecar resolves under `vue-tsc
 * --noEmit` (NOT the demoted `*.rozie` wildcard fallback) by asserting:
 *   1. a correct prop usage typechecks, and
 *   2. a wrong-typed prop is a genuine TS error.
 *
 * Per SPIKE-FINDINGS, vue-tsc honors the sidecar under the bundler default (no
 * `allowArbitraryExtensions` flag) and the sidecar takes precedence over the
 * wildcard. The `@ts-expect-error` line FAILS `vue-tsc --noEmit` if the error
 * does NOT occur (reported UNUSED) — the T-22-06-01 type-lying guard (a wildcard
 * shadow would make every prop `any`, silencing the typo).
 *
 * Picked up by the demo's `vue-tsc --noEmit` (include: src/**\/*). Never run.
 */
import Modal, { type ModalProps } from './Modal.rozie';

// 1. Correct usage — the sidecar's `ModalProps` is honored.
const ok: ModalProps = { open: true, title: 'Hello', closeOnEscape: false };
void ok;

// 2. Wrong-typed prop — `open` is `boolean`, a string must error.
// @ts-expect-error open is typed `boolean` by the Modal sidecar — a string is a type error.
const wrongType: ModalProps = { open: 'yes' };
void wrongType;

// The default export is the typed Vue component (anchors the import).
void Modal;

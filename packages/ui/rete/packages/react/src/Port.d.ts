import type { ReactNode } from 'react';

export interface PortProps {
  /**
   * Declares an OUTPUT port and names its key — set this (not `input`) so the port direction resolves to `output`. The attribute is `output`, not `out`: `out`/`in` are awkward bare identifiers, so `output`/`input` are used across all six targets.
   * @example
   * <Port output="num" type="number" />
   */
  output?: string;
  /**
   * Declares an INPUT port and names its key — set this (not `output`) so the port direction resolves to `input`. The attribute is `input`, not `in`: `in` is a JS reserved word that Svelte's mandatory `$props()` destructure rejects, so `input`/`output` are used instead.
   */
  input?: string;
  /**
   * The port TYPE — drives the canvas's typed-socket `:validate-types` (a type-mismatched connection is auto-rejected). It is the typed layer, NOT socket identity (a single shared Socket gates identity). Optional: an untyped port imposes no type constraint and connects to anything.
   */
  type?: string;
  /**
   * Optional socket label shown next to the port (defaults to the port key when omitted).
   */
  label?: string;
  /**
   * Allow multiple connections into/out of this socket. Left undefined by default to preserve the canvas's side asymmetry: outputs default to multi, inputs default to single. To force an explicit multi input, use the bare `multiple` attribute (`<Port ... multiple />`) — it resolves to `true` on all six targets.
   */
  multiple?: unknown;
  /**
   * Visual placement of the socket on the node: `left`, `right`, `top`, or `bottom`. Defaults by direction (input → left, output → right). `top`/`bottom` enable vertical flows (decision trees, top-down pipelines) — the canvas lays the socket out on that edge and the connection anchor shifts onto the matching axis.
   */
  position?: string;
}

declare function Port(props: PortProps): JSX.Element;
export default Port;

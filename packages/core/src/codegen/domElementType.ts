/**
 * Map an HTML tag name to its lib.dom `HTMLElement` subtype (Spike-012 R3-5
 * event-param typing pass).
 *
 * Used to type synthesized `$event` handler params precisely on the class/JSX
 * targets: a `@input` on an `<input>` gets a `currentTarget: HTMLInputElement`
 * so `$event.currentTarget.value` typechecks under a strict consumer. An unknown
 * / custom tag falls back to `HTMLElement` — still assignable to every JSX event
 * slot by contravariance, just less precise.
 *
 * Mirrors the tag→type switch the Angular emitter inlines for its `viewChild`
 * ElementRef generics (`emitScript.ts`); kept here as the single shared source so
 * Lit + Solid event-param typing agree on the same mapping.
 */
const TAG_TO_ELEMENT_TYPE: Readonly<Record<string, string>> = {
  input: 'HTMLInputElement',
  textarea: 'HTMLTextAreaElement',
  select: 'HTMLSelectElement',
  button: 'HTMLButtonElement',
  form: 'HTMLFormElement',
  a: 'HTMLAnchorElement',
  img: 'HTMLImageElement',
  div: 'HTMLDivElement',
  span: 'HTMLSpanElement',
  dialog: 'HTMLDialogElement',
  ul: 'HTMLUListElement',
  ol: 'HTMLOListElement',
  li: 'HTMLLIElement',
  option: 'HTMLOptionElement',
  label: 'HTMLLabelElement',
  p: 'HTMLParagraphElement',
  h1: 'HTMLHeadingElement',
  h2: 'HTMLHeadingElement',
  h3: 'HTMLHeadingElement',
  h4: 'HTMLHeadingElement',
  h5: 'HTMLHeadingElement',
  h6: 'HTMLHeadingElement',
  table: 'HTMLTableElement',
  video: 'HTMLVideoElement',
  audio: 'HTMLAudioElement',
  canvas: 'HTMLCanvasElement',
};

export function domElementType(tag: string): string {
  return TAG_TO_ELEMENT_TYPE[tag.toLowerCase()] ?? 'HTMLElement';
}

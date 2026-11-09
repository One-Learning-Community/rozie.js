/*
 * Plain-HTML host for the @rozie-ui/sortable-list-lit README quick start
 * (specs/sortable-lit-quickstart.spec.ts). No Rozie compiler is involved: the
 * page imports the PUBLISHED leaf package and runs the README snippet as
 * written. `lit`'s `html` is exposed on window so the spec can install other
 * row templates (handle mode, a nested list) the way a plain-Lit consumer
 * would.
 */
import { html } from 'lit';

export async function mountLitQuickstart(): Promise<void> {
  (window as unknown as { __litHtml: typeof html }).__litHtml = html;
  const host = document.createElement('div');
  host.id = 'lit-quickstart';
  host.appendChild(document.createElement('rozie-sortable-list'));
  document.body.appendChild(host);
  await import('./lit-quickstart');
  (window as unknown as { __quickstartReady: boolean }).__quickstartReady = true;
}

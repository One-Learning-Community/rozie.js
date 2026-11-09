// The @rozie-ui/sortable-list-lit README quick start, VERBATIM between the
// markers (specs/sortable-lit-quickstart.spec.ts checks it byte-for-byte
// against the rendered README). Do not edit the block by hand: regenerate the
// README and copy its Usage snippet here.
// --- README quick start ---
import { html } from 'lit';
import '@rozie-ui/sortable-list-lit'; // registers <rozie-sortable-list>
import type { SortableList } from '@rozie-ui/sortable-list-lit';

// The page holds <rozie-sortable-list></rozie-sortable-list>.
const el = document.querySelector<SortableList>('rozie-sortable-list')!;
el.itemKey = 'id';
el.items = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
];
// Row content: `rozieSlots.default` maps each row's
// { item, index, instructionsId } to a lit template.
el.rozieSlots = {
  default: ({ item }) => html`<span>${item.label}</span>`,
};
// `items` is two-way: the reordered array arrives in `items-change`.
el.addEventListener('items-change', (e) => {
  el.items = (e as CustomEvent<unknown[]>).detail;
});
// --- end README quick start ---

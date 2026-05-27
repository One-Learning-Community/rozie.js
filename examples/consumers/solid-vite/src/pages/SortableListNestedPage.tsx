import SortableListNestedDemo from '../../../../demos/SortableListNestedDemo.rozie';

export default function SortableListNestedPage() {
  return (
    <div data-testid="rozie-mount">
      <h2>SortableListNestedDemo (Solid Vite triage)</h2>
      <p>
        Drag a card between columns. Drop. Inspect whether records duplicate.
        Diagnoses whether the playground "duplicate-on-drop" is a real Solid
        compiler bug or a playground harness limit (esbuild + solid-js/h, no
        babel-plugin-jsx-dom-expressions).
      </p>
      <SortableListNestedDemo />
    </div>
  );
}

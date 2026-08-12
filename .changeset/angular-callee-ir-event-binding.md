---
"@rozie/core": patch
"@rozie/cli": patch
"@rozie/unplugin": patch
"@rozie/babel-plugin": patch
---

Angular target: consumer-side event bindings on composed component tags now resolve against the callee's declared `$emit` list, which the compiler threads onto the component-tag IR. Resolution is exact match first, then canonical match in first-declaration order, with literal passthrough when the child component never resolved. A resolved match lowers through the same public-name computation the callee's own output-declaration side uses, so the two seams cannot drift apart. This changes the compiled `(output)` binding names on component composition for direct `.rozie` compiler users and correctly serves BOTH authoring conventions at once: camel-authored emits (`$emit('rangeComplete')`, unaliased — the listener previously compiled to a dead hyphenated binding that never fired) and kebab-authored emits (`$emit('sort-change')`, aliased, the data-table / rete / command-palette convention — the public name stays the raw hyphenated string instead of being wrongly camelized).

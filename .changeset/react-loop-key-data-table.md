---
"@rozie-ui/data-table-react": patch
---

Regenerated with the React keyed-loop fix: the detail row no longer repeats the row key that its enclosing `Fragment` already carries, so two siblings no longer share one key. Rendered markup is unchanged.

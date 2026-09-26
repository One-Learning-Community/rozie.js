<!--
  PublishedTargetsNotice — the shared partial-debut notice.

  Renders the one-line "today only X is on npm" (or "not yet on npm") notice
  used on every page of a family that has not fully published all six
  framework targets yet. Single source of the wording + styling so every
  future partial debut gets the same treatment automatically.

  Usage:
    - Generated pages (`*-usage.md`, via gen-usage-pages.mjs) rely on page
      frontmatter: set `family: <slug>` and `publishedTargets: [solid]` (or
      `publishedTargets: []` for a fully held-back family like lexical) and
      drop in `<PublishedTargetsNotice />` with no props.
    - Hand-authored pages (the family index `<slug>.md`, demo/comparison
      pages) pass explicit props instead, since those pages carry no
      generated frontmatter:
        <PublishedTargetsNotice family="dialog" :published="['solid']" />
        <PublishedTargetsNotice family="lexical" :published="[]" />
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

const props = withDefaults(
  defineProps<{
    family?: string;
    published?: string[];
  }>(),
  {
    family: undefined,
    published: undefined,
  },
);

const { frontmatter } = useData();

const family = computed(() => props.family ?? (frontmatter.value.family as string | undefined));
const published = computed(
  () => props.published ?? (frontmatter.value.publishedTargets as string[] | undefined) ?? [],
);
</script>

<template>
  <div v-if="family" class="published-targets-notice custom-block tip">
    <p v-if="published.length === 0" class="custom-block-title">Not on npm yet</p>
    <p v-else class="custom-block-title">Solid-only debut</p>
    <p v-if="published.length === 0">
      <code>@rozie-ui/{{ family }}</code> is not yet on npm for any framework target — it is still in
      dogfooding across all six.
    </p>
    <p v-else>
      Today only <code>@rozie-ui/{{ family }}-{{ published.join(', ' + family + '-') }}</code> is on
      npm; the other framework packages are in dogfooding.
    </p>
  </div>
</template>

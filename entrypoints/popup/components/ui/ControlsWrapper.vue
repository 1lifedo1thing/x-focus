<script setup lang="ts">
defineProps<{ id?: string }>()
</script>

<template>
 <div
  :id="id || 'user-control-timeline'"
  class="p-4 bg-card-bg flex flex-col gap-y-4"
  :class="$attrs.class"
 >
  <slot />
 </div>
</template>

<script setup lang="ts">
defineProps<{ htmlFor?: string }>()
</script>

<template>
 <label
  :for="htmlFor || 'user-control-interface'"
  class="text-sm font-bold text-secondary-text text-secondary-text"
 >
  <slot />
 </label>
</template>

<script setup lang="ts">
import { Toggle } from 'reka-ui'
import { useStorageKey } from '../../composables/useStorageKey'

const props = defineProps<{
 storageKey: string
 label: string
 iconHtml?: string
 viewBox?: string
}>()

const { value, setValue } = useStorageKey(props.storageKey)
</script>

<template>
 <div class="flex flex-col items-center gap-0.5">
  <Toggle
   :model-value="value"
   @update:model-value="setValue"
   :title="`切换 ${label}`"
   :aria-label="`切换 ${label}`"
   class="bg-card-bg p-2 m-1 w-fit rounded-full border-[3px] border-accent data-[state=off]:border-transparent data-[state=off]:opacity-50 data-[state=off]:hover:border-white/50"
  >
   <svg
    v-if="iconHtml"
    width="25"
    height="25"
    aria-hidden="true"
    class="fill-current"
    :viewBox="viewBox ?? '0 0 24 24'"
    v-html="iconHtml"
   />
   <span v-else class="block w-[25px] h-[25px] rounded-full bg-secondary-text/20" aria-hidden="true" />
  </Toggle>
  <span
   class="text-xs text-center tracking-tight text-gray-400 truncate"
  >
   {{ label }}
  </span>
 </div>
</template>

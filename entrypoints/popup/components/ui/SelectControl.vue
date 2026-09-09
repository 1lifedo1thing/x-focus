<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { SelectRoot, SelectTrigger, SelectValue, SelectContent, SelectItem } from 'reka-ui'
import { getStorage, setStorage } from '../../../../content-scripts/utilities/storage'

const props = defineProps<{
 options: { value: string; label: string }[]
 storageKey: string
}>()

const model = ref(props.options[0]?.value || '')

onMounted(async () => {
 const stored = await getStorage(props.storageKey)
 if (stored !== undefined) {
  model.value = String(stored)
 }
})

watch(model, async (newVal) => {
 await setStorage({ [props.storageKey]: newVal })
})
</script>

<template>
 <SelectRoot v-if="options.length" v-model="model">
  <SelectTrigger
   class="flex items-center justify-between gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-secondary-text/30 text-secondary-text text-secondary-text bg-transparent hover:border-accent/50 hover:text-accent transition-colors duration-150 outline-none"
  >
   <SelectValue :placeholder="options[0]?.label" />
   <svg width="12" height="12" viewBox="0 0 15 15" fill="none" class="shrink-0">
    <path d="M4.5 6L7.5 9L10.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
   </svg>
  </SelectTrigger>
  <SelectContent
   align="end"
   class="min-w-[130px] rounded-lg border border-secondary-text/20 bg-body-bg shadow-lg overflow-hidden"
  >
   <SelectItem
    v-for="opt in options"
    :key="opt.value"
    :value="opt.value"
    class="px-3 py-1.5 text-[13px] cursor-pointer outline-none data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent data-[state=checked]:text-accent data-[state=checked]:font-medium transition-colors"
   >
    {{ opt.label }}
   </SelectItem>
  </SelectContent>
 </SelectRoot>
</template>

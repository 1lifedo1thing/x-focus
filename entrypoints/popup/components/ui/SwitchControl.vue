<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { useStorageKey } from '../../composables/useStorageKey'

const props = defineProps<{
  storageKey: string
  label: string
  disabled?: boolean
  labelClass?: string
}>()

const { value, loaded, setValue } = useStorageKey(props.storageKey)
</script>

<template>
 <div
  class="flex items-center justify-between w-full"
  :class="{ 'opacity-40 pointer-events-none': disabled }"
 >
  <label :for="storageKey" :class="labelClass || 'text-[12px] font-semibold text-color-text'">
   {{ label }}
  </label>
   <SwitchRoot
    v-if="loaded"
    :id="storageKey"
    :model-value="value"
    @update:model-value="setValue"
    class="w-8 h-[18px] rounded-full relative flex items-center cursor-pointer shrink-0"
    :class="value ? 'bg-accent' : 'bg-secondary-text/40'"
   >
    <SwitchThumb
     class="block w-3.5 h-3.5 rounded-full shadow transition-transform duration-100 bg-white"
     :class="value ? 'translate-x-[15px]' : 'translate-x-0.5'"
    />
   </SwitchRoot>
 </div>
</template>

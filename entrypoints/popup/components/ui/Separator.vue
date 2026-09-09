<script setup lang="ts">
import { Separator as RekaSeparator } from 'reka-ui'
</script>

<template>
 <RekaSeparator
  class="my-0.5 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full"
  :class="[($attrs.class as string) || '']"
 />
</template>

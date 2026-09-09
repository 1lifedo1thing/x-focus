<script setup lang="ts">
function closePopup() {
  window.close()
}
</script>

<template>
 <footer class="flex flex-col items-center w-full px-2 pb-4">
  <button
   type="button"
   class="inline-flex items-center px-4 py-2 text-[15px] font-bold text-white border border-transparent rounded-full shadow-sm bg-accent-active hover:bg-accent-hover focus:outline-none w-fit"
   @click="closePopup"
  >
   完成
  </button>
 </footer>
</template>

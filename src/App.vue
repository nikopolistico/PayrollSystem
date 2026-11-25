<script setup lang="ts">
import { pending } from '@/lib/api'
</script>

<template>
  <!-- Shows while anything loads or saves -->
  <div
    v-if="pending"
    class="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-ledger/15 print:hidden"
    role="progressbar"
    aria-label="Loading"
  >
    <div class="loading-bar h-full w-1/3 bg-ledger"></div>
  </div>
  <RouterView />
</template>

<script setup lang="ts">
defineProps<{ status: string }>()

const styles: Record<string, string> = {
  open: 'ring-1 ring-inset ring-rule text-muted',
  processed: 'ring-1 ring-inset ring-ledger text-ledger',
  released: 'bg-ledger text-white',
  inactive: 'ring-1 ring-inset ring-rule text-muted',
}
</script>

<template>
  <span
    class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
    :class="styles[status] ?? styles.open"
  >
    {{ status }}
  </span>
</template>

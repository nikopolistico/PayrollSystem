<script setup lang="ts">
import { ref, useId } from 'vue'

// Confirmation box for deletes: say exactly what goes in the slot, then Cancel or confirm.
// Native <dialog> gives Esc-to-close and keeps focus inside.
const props = defineProps<{
  title: string
  confirmLabel: string
  busy?: boolean
  busyLabel?: string
  error?: string
  tone?: 'danger' | 'primary' // red for deletes (default), green otherwise
}>()
defineEmits<{ confirm: [] }>()

const box = ref<HTMLDialogElement>()
const titleId = useId()
defineExpose({ open: () => box.value?.showModal(), close: () => box.value?.close() })
</script>

<template>
  <dialog ref="box" :aria-labelledby="titleId" class="modal max-w-sm" @click.self="box?.close()">
    <div class="grid gap-4 p-5 md:p-6">
      <h2 :id="titleId" class="text-xl font-bold">{{ title }}</h2>
      <slot />
      <p v-if="error" role="alert" class="text-sm text-debit">{{ error }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="box?.close()">Cancel</button>
        <button
          type="button"
          :class="props.tone === 'primary' ? 'btn' : 'btn-danger'"
          :disabled="busy"
          @click="$emit('confirm')"
        >
          {{ busy ? (busyLabel ?? 'Deleting…') : confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

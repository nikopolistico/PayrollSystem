<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Icon from '@/components/Icon.vue'
import { peso, post, useApi, type LineItem } from '@/lib/api'

// Modal to add, change or remove a payslip's earnings or deductions.
// Picking a type already on the payslip changes its amount.
const props = defineProps<{
  kind: 'earnings' | 'deductions'
  salaryId: number
  lines: LineItem[]
}>()
const emit = defineEmits<{ changed: [] }>()

const earning = props.kind === 'earnings' // kind never changes for one instance
const title = earning ? 'Earnings' : 'Deductions'
const noun = earning ? 'earning' : 'deduction'
const types = useApi<Record<string, string | number>[]>(
  earning ? '/api/admin/earning-types' : '/api/admin/deduction-types',
)
const options = computed(() =>
  (types.data.value ?? []).map((t) => ({
    id: Number(t.id),
    name: String(earning ? t.earning_name : t.deduction_name),
  })),
)

const box = ref<HTMLDialogElement>()
const titleId = useId()
const typeId = ref('')
const amount = ref('')
const busy = ref(false)
const error = ref('')
const existing = computed(() => props.lines.find((l) => l.type_id === Number(typeId.value)))
const url = (suffix = '') => `/api/admin/payslips/${props.salaryId}/${props.kind}${suffix}`

async function save() {
  busy.value = true
  error.value =
    (await post(url(), { type_id: Number(typeId.value), amount: amount.value })).error ?? ''
  busy.value = false
  if (error.value) return
  typeId.value = amount.value = ''
  emit('changed')
}

async function remove(line: LineItem) {
  if (busy.value || !window.confirm(`Remove ${line.name} from this payslip?`)) return
  busy.value = true
  error.value = (await post(url(`/${line.type_id}`), {}, 'DELETE')).error ?? ''
  busy.value = false
  emit('changed')
}

defineExpose({
  open: () => {
    error.value = ''
    box.value?.showModal()
  },
})
</script>

<template>
  <dialog ref="box" :aria-labelledby="titleId" class="modal max-w-md" @click.self="box?.close()">
    <div class="grid gap-5 p-5 md:p-6">
      <div>
        <h2 :id="titleId" class="text-xl font-bold">{{ title }}</h2>
        <p class="mt-1 text-sm text-muted">
          {{
            earning
              ? 'Allowances, holiday pay and bonuses on top of basic pay.'
              : 'Taken out of gross pay.'
          }}
          Net pay can't go below zero.
        </p>
      </div>

      <ul v-if="lines.length" class="text-sm">
        <li
          v-for="l in lines"
          :key="l.name"
          class="flex items-center justify-between gap-4 border-b border-rule py-1.5 last:border-0"
        >
          <span>{{ l.name }}</span>
          <span class="flex items-center gap-2">
            <span class="tabular-nums">{{ peso(l.amount) }}</span>
            <button
              type="button"
              class="icon-btn danger"
              :aria-label="`Remove ${l.name}`"
              :title="`Remove ${l.name}`"
              :disabled="busy"
              @click="remove(l)"
            >
              <Icon name="trash" />
            </button>
          </span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">No {{ kind }} on this payslip yet.</p>

      <p v-if="types.error.value" role="alert" class="text-sm text-debit">
        {{ types.error.value }}
      </p>

      <form class="grid gap-3" @submit.prevent="save">
        <div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <label class="field">
            Type
            <select v-model="typeId" required>
              <option value="" disabled>Choose {{ earning ? 'an earning' : 'a deduction' }}</option>
              <option v-for="t in options" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label class="field">
            Amount (₱)
            <input
              v-model="amount"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              required
            />
          </label>
        </div>
        <p v-if="existing" class="text-sm text-muted">
          {{ existing.name }} is already {{ peso(existing.amount) }}; saving replaces that amount.
        </p>
        <p v-if="error" role="alert" class="text-sm text-debit">{{ error }}</p>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn-ghost" @click="box?.close()">Done</button>
          <button type="submit" class="btn" :disabled="busy">
            <Icon v-if="!existing" name="plus" />
            {{ busy ? 'Saving…' : existing ? 'Change amount' : `Add ${noun}` }}
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

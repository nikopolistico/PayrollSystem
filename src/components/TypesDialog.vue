<script setup lang="ts">
import { ref, useId } from 'vue'
import Icon from '@/components/Icon.vue'
import { post, useApi } from '@/lib/api'

// Modal to view and add earning or deduction types (the lists picked from on a payslip).
const props = defineProps<{ kind: 'earning' | 'deduction' }>()

const config = {
  earning: {
    title: 'Earning types',
    url: '/api/admin/earning-types',
    name: 'earning_name',
    flag: 'is_taxable',
    tag: 'Taxable',
    flagLabel: 'Taxable (like holiday pay or a bonus)',
    example: 'Transportation Allowance',
  },
  deduction: {
    title: 'Deduction types',
    url: '/api/admin/deduction-types',
    name: 'deduction_name',
    flag: 'is_government',
    tag: 'Government',
    flagLabel: 'Government contribution (like SSS or PhilHealth)',
    example: 'Uniform',
  },
} as const
const c = config[props.kind] // kind never changes for one instance

const types = useApi<Record<string, string | number | boolean>[]>(c.url)
const box = ref<HTMLDialogElement>()
const titleId = useId()
const name = ref('')
const flag = ref(false)
const saving = ref(false)
const error = ref('')

async function add() {
  saving.value = true
  error.value = (await post(c.url, { [c.name]: name.value, [c.flag]: flag.value })).error ?? ''
  saving.value = false
  if (error.value) return
  name.value = ''
  flag.value = false
  types.reload()
}

defineExpose({ open: () => box.value?.showModal() })
</script>

<template>
  <dialog ref="box" :aria-labelledby="titleId" class="modal max-w-md" @click.self="box?.close()">
    <div class="grid gap-5 p-5 md:p-6">
      <div>
        <h2 :id="titleId" class="text-xl font-bold">{{ c.title }}</h2>
        <p class="mt-1 text-sm text-muted">The list you pick from on a payslip's View page.</p>
      </div>

      <ul class="max-h-56 overflow-y-auto text-sm">
        <li
          v-for="t in types.data.value"
          :key="String(t.id)"
          class="flex items-center justify-between gap-4 border-b border-rule py-2 last:border-0"
        >
          <span>{{ t[c.name] }}</span>
          <span
            v-if="t[c.flag]"
            class="rounded-full px-2 py-0.5 text-xs font-semibold text-ledger ring-1 ring-ledger ring-inset"
          >
            {{ c.tag }}
          </span>
        </li>
      </ul>

      <p v-if="types.error.value" role="alert" class="text-sm text-debit">
        {{ types.error.value }}
      </p>

      <form class="grid gap-3" @submit.prevent="add">
        <label class="field">
          New {{ kind }} type
          <input v-model="name" required maxlength="50" :placeholder="c.example" />
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="flag" type="checkbox" class="size-4 accent-ledger" />
          {{ c.flagLabel }}
        </label>
        <p v-if="error" role="alert" class="text-sm text-debit">{{ error }}</p>
        <div class="flex justify-end gap-3">
          <button type="button" class="btn-ghost" @click="box?.close()">Close</button>
          <button type="submit" class="btn" :disabled="saving">
            <Icon name="plus" />
            {{ saving ? 'Adding…' : 'Add type' }}
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import Icon from '@/components/Icon.vue'
import TypesDialog from '@/components/TypesDialog.vue'
import { peso, periodRange, post, useApi, type Payslip, type Period } from '@/lib/api'

const route = useRoute()
const router = useRouter()

const periods = useApi<Period[]>('/api/admin/periods')
// Week and department live in the URL (?period=3&dept=Operations) so links and refresh keep them.
const selected = computed(() => Number(route.query.period) || periods.data.value?.[0]?.id || null)
const period = computed(() => periods.data.value?.find((p) => p.id === selected.value))
const dept = computed(() => (typeof route.query.dept === 'string' ? route.query.dept : ''))
const slips = useApi<Payslip[]>(() =>
  selected.value ? `/api/admin/payslips?period=${selected.value}` : null,
)

const departmentNames = computed(() =>
  [...new Set((slips.data.value ?? []).map((s) => s.department_name))].sort(),
)
// One group per department (all, or just the filtered one), employees by name inside.
const groups = computed(() => {
  const map = new Map<string, Payslip[]>()
  for (const s of slips.data.value ?? []) {
    if (dept.value && s.department_name !== dept.value) continue
    map.set(s.department_name, [...(map.get(s.department_name) ?? []), s])
  }
  return [...map].sort(([a], [b]) => a.localeCompare(b))
})
const shown = computed(() => groups.value.flatMap(([, list]) => list))

const total = (list: Payslip[], key: keyof Payslip) =>
  list.reduce((sum, s) => sum + Number(s[key]), 0)
const error = computed(() => periods.error.value || slips.error.value)

function setQuery(key: 'period' | 'dept', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  router.replace({ query: { ...route.query, [key]: value || undefined } })
}

// Earning / deduction type lists, each in its own modal
const earningTypes = ref<InstanceType<typeof TypesDialog>>()
const deductionTypes = ref<InstanceType<typeof TypesDialog>>()

// Delete with a confirmation box that names exactly what goes.
const confirmBox = ref<InstanceType<typeof ConfirmDialog>>()
const toDelete = ref<Payslip>()
const deleting = ref(false)
const deleteError = ref('')
const deleted = ref('')

function askDelete(s: Payslip) {
  toDelete.value = s
  deleteError.value = ''
  confirmBox.value?.open()
}

async function confirmDelete() {
  const s = toDelete.value!
  deleting.value = true
  const res = await post(`/api/admin/payslips/${s.salary_id}`, {}, 'DELETE')
  deleting.value = false
  deleteError.value = res.error ?? ''
  if (res.error) return
  confirmBox.value?.close()
  deleted.value = `Deleted ${s.employee_name}'s payslip.`
  slips.reload()
}
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <Teleport defer to="#page-actions">
    <button type="button" class="btn-outline" @click="earningTypes?.open()">
      <Icon name="plus" />
      Earning types
    </button>
    <button type="button" class="btn-outline" @click="deductionTypes?.open()">
      <Icon name="plus" />
      Deduction types
    </button>
  </Teleport>

  <p v-if="periods.data.value && !periods.data.value.length" class="text-muted">
    No payroll periods yet. This week's period appears automatically.
  </p>

  <template v-else>
    <div class="flex flex-wrap items-end gap-4">
      <label class="field w-64">
        Week
        <select :value="selected ?? ''" @change="setQuery('period', $event)">
          <option v-for="p in periods.data.value" :key="p.id" :value="p.id">
            {{ periodRange(p.period_start, p.period_end) }}
          </option>
        </select>
      </label>
      <label class="field w-64">
        Department
        <select :value="dept" @change="setQuery('dept', $event)">
          <option value="">All departments</option>
          <option v-for="d in departmentNames" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-end gap-3">
      <RouterLink
        v-if="shown.length"
        :to="{
          path: '/admin/payslips/print-all',
          query: { period: selected, dept: dept || undefined },
        }"
        class="btn"
      >
        View all {{ dept ? `${dept} ` : '' }}payslips ({{ shown.length }})
      </RouterLink>
    </div>

    <p v-if="deleted" role="status" class="mt-4 text-ledger">{{ deleted }}</p>

    <p v-if="slips.data.value && !shown.length" class="mt-8 text-muted">
      No payslips in this week yet. Use Save to payslips on the Payroll periods page.
    </p>

    <!-- Totals for what is shown -->
    <dl
      v-if="shown.length"
      class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule lg:grid-cols-4"
    >
      <div class="bg-sheet p-4">
        <dt class="text-sm text-muted">Payslips{{ dept ? `, ${dept}` : ', all departments' }}</dt>
        <dd class="mt-1 text-2xl font-bold tabular-nums">{{ shown.length }}</dd>
      </div>
      <div class="bg-sheet p-4">
        <dt class="text-sm text-muted">Gross pay</dt>
        <dd class="mt-1 text-2xl font-bold tabular-nums">{{ peso(total(shown, 'gross_pay')) }}</dd>
      </div>
      <div class="bg-sheet p-4">
        <dt class="text-sm text-muted">Deductions</dt>
        <dd class="mt-1 text-2xl font-bold text-debit tabular-nums">
          {{ peso(total(shown, 'total_deductions')) }}
        </dd>
      </div>
      <div class="bg-sheet p-4">
        <dt class="text-sm text-muted">Net pay</dt>
        <dd class="mt-1 text-2xl font-bold tabular-nums">{{ peso(total(shown, 'net_pay')) }}</dd>
      </div>
    </dl>

    <!-- One table per department -->
    <section
      v-for="[name, list] in groups"
      :key="name"
      class="mt-8"
      :aria-label="`${name} payslips`"
    >
      <h2 class="font-bold">
        {{ name }}
        <span class="text-sm font-normal text-muted">
          {{ list.length }} {{ list.length === 1 ? 'payslip' : 'payslips' }}
        </span>
      </h2>
      <div class="mt-2 overflow-x-auto rounded-lg border border-rule bg-sheet">
        <!-- Fixed column widths so every department's table lines up -->
        <table class="ledger min-w-4xl table-fixed">
          <thead>
            <tr>
              <th class="w-1/5">Employee</th>
              <th class="num">Days</th>
              <th class="num">OT hours</th>
              <th class="num">Basic pay</th>
              <th class="num">Overtime pay</th>
              <th class="num">Other earnings</th>
              <th class="num">Deductions</th>
              <th class="num">Net pay</th>
              <th class="w-24"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in list" :key="s.salary_id">
              <td class="font-medium">
                {{ s.employee_name }}
                <span class="block text-xs font-normal text-muted tabular-nums">{{
                  s.employee_no
                }}</span>
              </td>
              <td class="num">{{ Number(s.days_worked) }}</td>
              <td class="num">{{ Number(s.overtime_hours) }}</td>
              <td class="num">{{ peso(s.basic_pay) }}</td>
              <td class="num">{{ peso(s.overtime_pay) }}</td>
              <td class="num">{{ peso(s.other_earnings) }}</td>
              <td class="num text-debit">{{ peso(s.total_deductions) }}</td>
              <td class="num font-semibold">{{ peso(s.net_pay) }}</td>
              <td>
                <div class="flex items-center justify-end gap-3">
                  <RouterLink
                    :to="`/admin/payslips/${s.salary_id}/print`"
                    class="font-semibold text-ledger hover:underline"
                    :aria-label="`View and print payslip of ${s.employee_name}`"
                  >
                    View
                  </RouterLink>
                  <button
                    v-if="period?.status === 'open'"
                    type="button"
                    class="icon-btn danger"
                    :aria-label="`Delete payslip of ${s.employee_name}`"
                    :title="`Delete payslip of ${s.employee_name}`"
                    @click="askDelete(s)"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">{{ name }} total</td>
              <td class="num">{{ peso(total(list, 'basic_pay')) }}</td>
              <td class="num">{{ peso(total(list, 'overtime_pay')) }}</td>
              <td class="num">{{ peso(total(list, 'other_earnings')) }}</td>
              <td class="num text-debit">{{ peso(total(list, 'total_deductions')) }}</td>
              <td class="num">{{ peso(total(list, 'net_pay')) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  </template>

  <ConfirmDialog
    ref="confirmBox"
    title="Delete this payslip?"
    confirm-label="Delete payslip"
    :busy="deleting"
    :error="deleteError"
    @confirm="confirmDelete"
  >
    <template v-if="toDelete">
      <dl class="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt class="text-muted">Employee</dt>
        <dd class="font-semibold">{{ toDelete.employee_name }}</dd>
        <dt class="text-muted">Department</dt>
        <dd>{{ toDelete.department_name }}</dd>
        <dt class="text-muted">Week</dt>
        <dd>{{ periodRange(toDelete.period_start, toDelete.period_end) }}</dd>
        <dt class="text-muted">Net pay</dt>
        <dd class="font-semibold tabular-nums">{{ peso(toDelete.net_pay) }}</dd>
      </dl>
      <p class="text-sm text-muted">
        Its earnings and deductions are deleted too. Save to payslips again on the Payroll periods
        page to rebuild it from attendance.
      </p>
    </template>
  </ConfirmDialog>

  <TypesDialog ref="earningTypes" kind="earning" />
  <TypesDialog ref="deductionTypes" kind="deduction" />
</template>

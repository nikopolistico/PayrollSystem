<script setup lang="ts">
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { day, peso, periodRange, useApi, type Employee, type Period } from '@/lib/api'

const periods = useApi<Period[]>('/api/admin/periods')
const employees = useApi<Employee[]>('/api/admin/employees')

const latest = computed(() => periods.data.value?.[0])
const recent = computed(() => periods.data.value?.slice(0, 5) ?? [])
const activeCount = computed(() => employees.data.value?.filter((e) => e.is_active).length)
const error = computed(() => periods.error.value || employees.error.value)
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <dl
    class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule lg:grid-cols-4"
  >
    <div class="bg-sheet p-4 md:p-5">
      <dt class="text-sm text-muted">Active employees</dt>
      <dd class="mt-1 text-2xl font-bold tabular-nums">
        {{ activeCount ?? '–' }}
      </dd>
    </div>
    <div class="bg-sheet p-4 md:p-5">
      <dt class="text-sm text-muted">Latest period</dt>
      <dd class="mt-1 font-semibold">
        <template v-if="latest">
          {{ periodRange(latest.period_start, latest.period_end) }}
          <StatusTag :status="latest.status" class="mt-1" />
        </template>
        <template v-else>–</template>
      </dd>
    </div>
    <div class="bg-sheet p-4 md:p-5">
      <dt class="text-sm text-muted">Net pay, latest period</dt>
      <dd class="mt-1 text-2xl font-bold tabular-nums">
        {{ latest ? peso(latest.net_pay) : '–' }}
      </dd>
    </div>
    <div class="bg-sheet p-4 md:p-5">
      <dt class="text-sm text-muted">Payslips, latest period</dt>
      <dd class="mt-1 text-2xl font-bold tabular-nums">{{ latest?.payslips ?? '–' }}</dd>
    </div>
  </dl>

  <section class="mt-10" aria-labelledby="recent">
    <div class="flex items-baseline justify-between gap-4">
      <h2 id="recent" class="text-lg font-bold">Recent payroll periods</h2>
      <RouterLink to="/admin/periods" class="text-sm font-semibold text-ledger hover:underline">
        See all periods
      </RouterLink>
    </div>

    <div class="mt-3 overflow-x-auto rounded-lg border border-rule bg-sheet">
      <table class="ledger">
        <thead>
          <tr>
            <th>Period</th>
            <th>Pay date</th>
            <th>Status</th>
            <th class="num">Gross pay</th>
            <th class="num">Deductions</th>
            <th class="num">Net pay</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in recent" :key="p.id">
            <td class="font-medium">
              <RouterLink
                :to="`/admin/payslips?period=${p.id}`"
                class="hover:text-ledger hover:underline"
              >
                {{ periodRange(p.period_start, p.period_end) }}
              </RouterLink>
            </td>
            <td>{{ day(p.pay_date) }}</td>
            <td><StatusTag :status="p.status" /></td>
            <td class="num">{{ peso(p.gross_pay) }}</td>
            <td class="num text-debit">{{ peso(p.total_deductions) }}</td>
            <td class="num font-semibold">{{ peso(p.net_pay) }}</td>
          </tr>
          <tr v-if="periods.data.value && !recent.length">
            <td colspan="6" class="py-10 text-center whitespace-normal text-muted">
              No payroll periods yet. This week's period (Sunday to Saturday) appears here
              automatically.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PayslipSheet from '@/components/PayslipSheet.vue'
import { periodRange, useApi, type MyPayslip } from '@/lib/api'

// Every payslip of one week (optionally one department), one A4 landscape sheet each, to print in one go.
const route = useRoute()
const period = computed(() => Number(route.query.period) || null)
const dept = computed(() => (typeof route.query.dept === 'string' ? route.query.dept : ''))
const {
  data: slips,
  error,
} = useApi<MyPayslip[]>(() =>
  period.value
    ? `/api/admin/payslip-sheets?period=${period.value}&dept=${encodeURIComponent(dept.value)}`
    : null,
)
const back = computed(() => ({
  path: '/admin/payslips',
  query: { period: period.value, dept: dept.value || undefined },
}))
const print = () => window.print()
</script>

<template>
  <div class="min-h-dvh px-4 py-6 print:p-0">
    <div
      class="mx-auto mb-6 flex max-w-[297mm] flex-wrap items-center justify-between gap-4 print:hidden"
    >
      <div>
        <RouterLink :to="back" class="font-semibold text-ledger hover:underline"
          >Back to payslips</RouterLink
        >
        <p v-if="slips?.length" class="mt-1 text-sm text-muted">
          {{ slips.length }} {{ slips.length === 1 ? 'payslip' : 'payslips' }},
          {{ dept || 'all departments' }},
          {{ periodRange(slips[0]!.period_start, slips[0]!.period_end) }}. One A4 landscape sheet
          each.
        </p>
      </div>
      <button type="button" class="btn" :disabled="!slips?.length" @click="print">
        Print all {{ slips?.length ?? '' }}
      </button>
    </div>

    <p v-if="error" role="alert" class="text-center text-debit">{{ error }}</p>
    <p v-if="slips && !slips.length" class="text-center text-muted">
      No payslips for {{ dept || 'any department' }} this week yet.
    </p>

    <!-- Each sheet starts a new printed page -->
    <div
      v-for="s in slips"
      :key="s.salary_id"
      class="mb-6 overflow-x-auto print:mb-0 print:overflow-visible print:break-after-page print:last:break-after-auto"
    >
      <PayslipSheet :s="s" />
    </div>
  </div>
</template>

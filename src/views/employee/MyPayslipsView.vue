<script setup lang="ts">
import { day, peso, periodRange, useApi, type MyPayslip } from '@/lib/api'

const { data: slips, error } = useApi<MyPayslip[]>('/api/employee/payslips')
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <p v-if="slips && !slips.length" class="max-w-prose text-muted">
    No payslips yet. Your payslip shows here once payroll for a period is processed.
  </p>

  <div class="grid max-w-2xl gap-4">
    <!-- Each payslip is a pay stub: summary on top, tear line, then the breakdown -->
    <details
      v-for="(s, i) in slips"
      :key="s.salary_id"
      :open="i === 0"
      class="group rounded-lg border border-rule bg-sheet"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-4 p-4 md:p-6 [&::-webkit-details-marker]:hidden"
      >
        <span>
          <span class="block font-semibold">{{ periodRange(s.period_start, s.period_end) }}</span>
          <span class="block text-sm text-muted">Paid {{ day(s.pay_date) }}</span>
        </span>
        <span class="flex items-center gap-3">
          <span class="text-right">
            <span class="block text-sm text-muted">Net pay</span>
            <span class="block text-xl font-bold tabular-nums md:text-2xl">{{
              peso(s.net_pay)
            }}</span>
          </span>
          <svg
            class="size-5 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>

      <div class="border-t-2 border-dashed border-rule px-4 pt-4 pb-6 md:px-6">
        <dl class="grid gap-y-2.5 text-sm md:text-base">
          <div class="flex justify-between gap-4">
            <dt>
              Basic pay
              <span class="block text-sm text-muted">
                {{ Number(s.days_worked) }} days at {{ peso(s.daily_rate) }}
              </span>
            </dt>
            <dd class="tabular-nums">{{ peso(s.basic_pay) }}</dd>
          </div>
          <div v-if="Number(s.overtime_hours)" class="flex justify-between gap-4">
            <dt>
              Overtime
              <span class="block text-sm text-muted">{{ Number(s.overtime_hours) }} hours</span>
            </dt>
            <dd class="tabular-nums">{{ peso(s.overtime_pay) }}</dd>
          </div>
          <div v-for="e in s.earnings" :key="e.name" class="flex justify-between gap-4">
            <dt>{{ e.name }}</dt>
            <dd class="tabular-nums">{{ peso(e.amount) }}</dd>
          </div>
          <div class="flex justify-between gap-4 border-t border-rule pt-2.5 font-semibold">
            <dt>Gross pay</dt>
            <dd class="tabular-nums">{{ peso(s.gross_pay) }}</dd>
          </div>

          <template v-if="s.deductions.length">
            <div
              v-for="d in s.deductions"
              :key="d.name"
              class="flex justify-between gap-4 text-debit"
            >
              <dt>{{ d.name }}</dt>
              <dd class="tabular-nums">−{{ peso(d.amount) }}</dd>
            </div>
            <div
              class="flex justify-between gap-4 border-t border-rule pt-2.5 font-semibold text-debit"
            >
              <dt>Total deductions</dt>
              <dd class="tabular-nums">−{{ peso(s.total_deductions) }}</dd>
            </div>
          </template>

          <!-- Double underline: the accountant's mark for a final total -->
          <div class="mt-2 flex items-end justify-between gap-4">
            <dt class="font-bold">Net pay</dt>
            <dd
              class="border-b-4 border-double border-ink text-2xl font-bold tabular-nums md:text-3xl"
            >
              {{ peso(s.net_pay) }}
            </dd>
          </div>
        </dl>
      </div>
    </details>
  </div>
</template>

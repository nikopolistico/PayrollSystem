<script setup lang="ts">
import { day, peso, periodRange, type MyPayslip } from '@/lib/api'

// One A4 landscape sheet with two identical copies side by side (employee + company).
defineProps<{ s: MyPayslip }>()
const copies = ['Employee copy', 'Company copy']
</script>

<template>
  <article
    class="payslip-sheet mx-auto grid h-[210mm] w-[297mm] grid-cols-2 bg-white p-[8mm] text-[9.5pt] leading-snug text-ink shadow-sm print:shadow-none"
  >
    <section
      v-for="(copy, i) in copies"
      :key="copy"
      :class="i === 0 ? 'border-r border-dashed border-muted pr-[8mm]' : 'pl-[8mm]'"
      class="flex flex-col"
    >
      <header class="flex items-start justify-between border-b-2 border-ink pb-2">
        <div>
          <p class="text-[14pt] font-bold tracking-tight">Payslip</p>
          <p class="text-muted">Payroll System</p>
        </div>
        <p class="rounded-full px-2 py-0.5 text-[8pt] font-semibold ring-1 ring-ink">{{ copy }}</p>
      </header>

      <dl class="mt-3 grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1">
        <dt class="text-muted">Employee</dt>
        <dd class="font-semibold">{{ s.employee_name }}</dd>
        <dt class="text-muted">Employee no.</dt>
        <dd class="tabular-nums">{{ s.employee_no }}</dd>
        <dt class="text-muted">Position</dt>
        <dd>{{ s.position }}</dd>
        <dt class="text-muted">Department</dt>
        <dd>{{ s.department_name }}</dd>
        <dt class="text-muted">Pay period</dt>
        <dd>{{ periodRange(s.period_start, s.period_end) }}</dd>
        <dt class="text-muted">Pay date</dt>
        <dd>{{ day(s.pay_date) }}</dd>
      </dl>

      <table class="mt-4 w-full">
        <thead>
          <tr class="border-b border-ink">
            <th class="py-1 text-left font-semibold">Earnings</th>
            <th class="py-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody class="tabular-nums">
          <tr class="border-b border-rule">
            <td class="py-1">
              Basic pay
              <span class="text-muted">
                ({{ (Number(s.days_worked) * 8).toFixed(2) }} hrs, {{ Number(s.days_worked) }} days
                at {{ peso(s.daily_rate) }})
              </span>
            </td>
            <td class="py-1 text-right">{{ peso(s.basic_pay) }}</td>
          </tr>
          <tr v-if="Number(s.overtime_hours)" class="border-b border-rule">
            <td class="py-1">
              Overtime <span class="text-muted">({{ Number(s.overtime_hours) }} hrs)</span>
            </td>
            <td class="py-1 text-right">{{ peso(s.overtime_pay) }}</td>
          </tr>
          <tr v-for="e in s.earnings" :key="e.name" class="border-b border-rule">
            <td class="py-1">{{ e.name }}</td>
            <td class="py-1 text-right">{{ peso(e.amount) }}</td>
          </tr>
          <tr class="font-semibold">
            <td class="py-1">Gross pay</td>
            <td class="py-1 text-right">{{ peso(s.gross_pay) }}</td>
          </tr>
        </tbody>
      </table>

      <table class="mt-3 w-full">
        <thead>
          <tr class="border-b border-ink">
            <th class="py-1 text-left font-semibold">Deductions</th>
            <th class="py-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody class="tabular-nums">
          <tr v-for="d in s.deductions" :key="d.name" class="border-b border-rule">
            <td class="py-1">{{ d.name }}</td>
            <td class="py-1 text-right">{{ peso(d.amount) }}</td>
          </tr>
          <tr v-if="!s.deductions.length" class="border-b border-rule">
            <td class="py-1 text-muted">None</td>
            <td class="py-1 text-right">{{ peso(0) }}</td>
          </tr>
          <tr class="font-semibold">
            <td class="py-1">Total deductions</td>
            <td class="py-1 text-right">{{ peso(s.total_deductions) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Double underline: the accountant's mark for a final total -->
      <div class="mt-4 flex items-end justify-between">
        <p class="font-bold">Net pay</p>
        <p class="border-b-4 border-double border-ink text-[16pt] font-bold tabular-nums">
          {{ peso(s.net_pay) }}
        </p>
      </div>

      <footer class="mt-auto grid grid-cols-2 gap-6 pt-6">
        <div>
          <div class="h-8 border-b border-ink"></div>
          <p class="mt-1 text-[8pt] text-muted">Received by (signature over printed name)</p>
        </div>
        <div>
          <div class="h-8 border-b border-ink"></div>
          <p class="mt-1 text-[8pt] text-muted">Date received</p>
        </div>
      </footer>
    </section>
  </article>
</template>

<style>
/* Named page: only this sheet prints A4 landscape; other prints (QR card) keep the default. */
@page payslip {
  size: A4 landscape;
  margin: 0;
}
.payslip-sheet {
  page: payslip;
  print-color-adjust: exact;
}
</style>

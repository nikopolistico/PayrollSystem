<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import {
  day,
  peso,
  periodRange,
  post,
  useApi,
  type HoursRow,
  type Period,
  type PeriodHours,
  type WageRate,
} from '@/lib/api'

const route = useRoute()
const router = useRouter()
const {
  data: periods,
  error,
  reload: reloadPeriods,
} = useApi<Period[]>('/api/admin/periods')
const wages = useApi<WageRate[]>('/api/admin/wage-rates')

// Newest rate already in effect (a rate can be set ahead of its start date).
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' })
const current = computed(() => wages.data.value?.find((w) => w.effective_date <= today))
const upcoming = computed(() => wages.data.value?.find((w) => w.effective_date > today))

// ---- Payroll summary for one week (?week=<period id>, default: newest = this week) ----
const week = computed(() => Number(route.query.week) || periods.value?.[0]?.id || null)
const summary = useApi<PeriodHours>(() =>
  week.value ? `/api/admin/periods/${week.value}/hours` : null,
)
const period = computed(() => summary.data.value?.period)
const rows = computed(() => summary.data.value?.rows ?? [])

const total = (list: HoursRow[], key: 'hours_rendered' | 'paid_hours' | 'basic_pay') =>
  list.reduce((sum, r) => sum + Number(r[key]), 0)

// Rows arrive sorted by department, so grouping keeps that order.
const departments = computed(() => {
  const groups = new Map<string, HoursRow[]>()
  for (const r of rows.value)
    groups.set(r.department_name, [...(groups.get(r.department_name) ?? []), r])
  return [...groups]
})
const missing = computed(() => rows.value.reduce((n, r) => n + r.missing_out, 0))

function pickWeek(event: Event) {
  router.replace({ query: { ...route.query, week: (event.target as HTMLSelectElement).value } })
}

// Tabs; the open tab lives in the URL (?tab=weeks) so a refresh keeps it.
const tabs = [
  { id: 'summary', label: 'Payroll summary' },
  { id: 'weeks', label: 'All weeks' },
] as const
const tab = computed(() => (route.query.tab === 'weeks' ? 'weeks' : 'summary'))
function setTab(id: (typeof tabs)[number]['id']) {
  router.replace({ query: { ...route.query, tab: id === 'weeks' ? 'weeks' : undefined } })
}

const saving = ref(false)
const saveError = ref('')
const saved = ref('')
async function saveToPayslips() {
  saving.value = true
  saved.value = ''
  const res = await post<{ saved: number }>(`/api/admin/periods/${week.value}/generate`, {})
  saving.value = false
  saveError.value = res.error ?? ''
  if (res.data) saved.value = `Saved ${res.data.saved} payslips for this week.`
  summary.reload()
  reloadPeriods()
}

// ---- "Set daily wage" modal: native <dialog> gives Esc-to-close and keeps focus inside ----
const dialog = ref<HTMLDialogElement>()
const rate = ref('')
const startDate = ref(today)
const wageSaving = ref(false)
const wageError = ref('')
const wageSaved = ref('')

function openWage() {
  rate.value = ''
  startDate.value = today
  wageError.value = ''
  dialog.value?.showModal()
}

async function saveWage() {
  wageSaving.value = true
  const res = await post('/api/admin/wage-rates', {
    daily_rate: rate.value,
    effective_date: startDate.value,
  })
  wageSaving.value = false
  wageError.value = res.error ?? ''
  if (res.error) return
  wageSaved.value = `Daily wage ${peso(rate.value)} starts ${day(startDate.value)}.`
  dialog.value?.close()
  wages.reload()
  summary.reload()
}
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <!-- Daily wage -->
  <div
    class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule bg-sheet px-4 py-4 md:px-6"
  >
    <div>
      <p class="text-sm text-muted">Daily wage for 8 hours</p>
      <p class="mt-0.5 flex flex-wrap items-baseline gap-x-3">
        <span class="text-2xl font-bold tabular-nums">{{
          current ? peso(current.daily_rate) : '–'
        }}</span>
        <span v-if="current" class="text-sm text-muted">
          {{ peso(Number(current.daily_rate) / 8) }} an hour, since
          {{ day(current.effective_date) }}
        </span>
      </p>
      <p v-if="upcoming" class="mt-1 text-sm text-ledger">
        {{ peso(upcoming.daily_rate) }} starts {{ day(upcoming.effective_date) }}
      </p>
    </div>
    <button type="button" class="btn" @click="openWage">Set daily wage</button>
  </div>
  <p v-if="wageSaved" role="status" class="mt-2 text-sm text-ledger">{{ wageSaved }}</p>
  <p v-if="wages.error.value" role="alert" class="mt-2 text-sm text-debit">
    {{ wages.error.value }}
  </p>

  <div role="tablist" aria-label="Payroll" class="mt-8 flex gap-2 border-b border-rule">
    <button
      v-for="t in tabs"
      :id="`tab-${t.id}`"
      :key="t.id"
      type="button"
      role="tab"
      :aria-selected="tab === t.id"
      :aria-controls="`panel-${t.id}`"
      class="-mb-px border-b-2 px-4 py-2.5 font-semibold"
      :class="
        tab === t.id ? 'border-ledger text-ledger' : 'border-transparent text-muted hover:text-ink'
      "
      @click="setTab(t.id)"
    >
      {{ t.label }}
    </button>
  </div>

  <!-- Payroll summary -->
  <section
    v-show="tab === 'summary'"
    id="panel-summary"
    role="tabpanel"
    aria-labelledby="tab-summary"
    class="pt-6"
  >
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-sm text-muted">
        All departments, from QR attendance. Paid hours count up to 8 a day.
      </p>
      <label class="field w-64">
        Week
        <select :value="week ?? ''" @change="pickWeek">
          <option v-for="p in periods" :key="p.id" :value="p.id">
            {{ periodRange(p.period_start, p.period_end) }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="summary.error.value" role="alert" class="mt-4 text-debit">{{ summary.error.value }}</p>

    <template v-if="period">
      <p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <StatusTag :status="period.status" />
        <span class="text-muted">Pay date {{ day(period.pay_date) }}</span>
        <span v-if="period.rate" class="text-muted">
          Daily wage {{ peso(period.rate.daily_rate) }} ({{ peso(period.rate.daily_rate / 8) }} an
          hour)
        </span>
        <span v-else class="text-debit"
          >No daily wage starts on or before this week. Set one above.</span
        >
      </p>

      <p
        v-if="missing"
        role="alert"
        class="mt-4 rounded-md bg-debit/10 px-4 py-3 text-sm text-debit"
      >
        {{ missing }} {{ missing === 1 ? 'time in has' : 'time ins have' }} no time out, so those
        hours count as 0. Check the Attendance page.
      </p>

      <!-- Totals across all departments -->
      <dl
        v-if="rows.length"
        class="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule lg:grid-cols-4"
      >
        <div class="bg-sheet p-4">
          <dt class="text-sm text-muted">Employees paid</dt>
          <dd class="mt-1 text-2xl font-bold tabular-nums">{{ rows.length }}</dd>
        </div>
        <div class="bg-sheet p-4">
          <dt class="text-sm text-muted">Hours rendered</dt>
          <dd class="mt-1 text-2xl font-bold tabular-nums">
            {{ total(rows, 'hours_rendered').toFixed(2) }}
          </dd>
        </div>
        <div class="bg-sheet p-4">
          <dt class="text-sm text-muted">Paid hours</dt>
          <dd class="mt-1 text-2xl font-bold tabular-nums">
            {{ total(rows, 'paid_hours').toFixed(2) }}
          </dd>
        </div>
        <div class="bg-sheet p-4">
          <dt class="text-sm text-muted">Basic pay, all departments</dt>
          <dd class="mt-1 text-2xl font-bold tabular-nums">{{ peso(total(rows, 'basic_pay')) }}</dd>
        </div>
      </dl>

      <p v-if="summary.data.value && !rows.length" class="mt-6 text-muted">
        No attendance this week yet. Hours show here once employees scan their QR.
      </p>

      <!-- One table per department -->
      <div v-for="[dept, list] in departments" :key="dept" class="mt-6">
        <h3 class="font-bold">
          {{ dept }}
          <span class="text-sm font-normal text-muted">
            {{ list.length }} {{ list.length === 1 ? 'employee' : 'employees' }}
          </span>
        </h3>
        <div class="mt-2 overflow-x-auto rounded-lg border border-rule bg-sheet">
          <!-- Fixed column widths so every department's table lines up -->
          <table class="ledger min-w-xl table-fixed">
            <thead>
              <tr>
                <th class="w-2/5">Employee</th>
                <th class="num">Days present</th>
                <th class="num">Hours rendered</th>
                <th class="num">Paid hours</th>
                <th class="num">Basic pay</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in list" :key="r.employee_id">
                <td>
                  <span class="block font-semibold">{{ r.name }}</span>
                  <span class="block text-xs text-muted tabular-nums">{{ r.employee_no }}</span>
                </td>
                <td class="num">{{ r.days_present }}</td>
                <td class="num">
                  {{ r.hours_rendered }}
                  <span v-if="r.missing_out" class="block text-xs text-debit">
                    {{ r.missing_out }} missing time out
                  </span>
                </td>
                <td class="num">{{ r.paid_hours }}</td>
                <td class="num font-semibold">{{ peso(r.basic_pay) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">{{ dept }} total</td>
                <td class="num">{{ total(list, 'hours_rendered').toFixed(2) }}</td>
                <td class="num">{{ total(list, 'paid_hours').toFixed(2) }}</td>
                <td class="num">{{ peso(total(list, 'basic_pay')) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div
        v-if="period.status === 'open' && rows.length"
        class="mt-6 flex flex-wrap items-center gap-4"
      >
        <button
          type="button"
          class="btn"
          :disabled="saving || !period.rate"
          @click="saveToPayslips"
        >
          {{ saving ? 'Saving…' : 'Save to payslips' }}
        </button>
        <p class="max-w-prose text-sm text-muted">
          Writes this week's hours into payslips. Saving again updates them.
        </p>
      </div>
      <p v-if="saveError" role="alert" class="mt-3 text-debit">{{ saveError }}</p>
      <p v-if="saved" role="status" class="mt-3 text-ledger">
        {{ saved }}
        <RouterLink :to="`/admin/payslips?period=${period.id}`" class="font-semibold underline">
          View payslips
        </RouterLink>
      </p>
    </template>
  </section>

  <!-- All weeks -->
  <section
    v-show="tab === 'weeks'"
    id="panel-weeks"
    role="tabpanel"
    aria-labelledby="tab-weeks"
    class="pt-6"
  >
    <p class="text-sm text-muted">
      Sunday to Saturday, paid on Saturday. Open a week's summary to see hours per department.
    </p>

    <div class="mt-3 overflow-x-auto rounded-lg border border-rule bg-sheet">
      <table class="ledger">
        <thead>
          <tr>
            <th>Period</th>
            <th>Pay date</th>
            <th>Status</th>
            <th class="num">Payslips</th>
            <th class="num">Gross pay</th>
            <th class="num">Deductions</th>
            <th class="num">Net pay</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in periods" :key="p.id" :class="{ 'bg-ledger/5': p.id === week }">
            <td class="font-medium">{{ periodRange(p.period_start, p.period_end) }}</td>
            <td>{{ day(p.pay_date) }}</td>
            <td><StatusTag :status="p.status" /></td>
            <td class="num">{{ p.payslips }}</td>
            <td class="num">{{ peso(p.gross_pay) }}</td>
            <td class="num text-debit">{{ peso(p.total_deductions) }}</td>
            <td class="num font-semibold">{{ peso(p.net_pay) }}</td>
            <td class="space-x-4 text-right">
              <RouterLink
                :to="{ query: { week: p.id } }"
                class="font-semibold text-ledger hover:underline"
              >
                Summary
              </RouterLink>
              <RouterLink
                :to="`/admin/payslips?period=${p.id}`"
                class="font-semibold text-ledger hover:underline"
              >
                Payslips
              </RouterLink>
            </td>
          </tr>
          <tr v-if="periods && !periods.length">
            <td colspan="8" class="py-10 text-center whitespace-normal text-muted">
              No payroll periods yet. This week's period (Sunday to Saturday) appears here
              automatically.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <dialog
    ref="dialog"
    aria-labelledby="wage-title"
    class="modal max-w-md"
    @click.self="dialog?.close()"
  >
    <form class="grid gap-5 p-5 md:p-6" @submit.prevent="saveWage">
      <div>
        <h2 id="wage-title" class="text-xl font-bold">Set daily wage</h2>
        <p class="mt-1 text-sm text-muted">
          Pay for 8 hours. Fewer hours get the hourly share: with ₱475, 6 hours pays
          {{ peso((475 / 8) * 6) }}.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field">
          New daily wage (₱)
          <input v-model="rate" type="number" inputmode="decimal" min="0.01" step="0.01" required />
        </label>
        <label class="field">
          Starts on
          <input v-model="startDate" type="date" required />
        </label>
      </div>
      <p class="-mt-2 text-sm text-muted">Periods that end before this date keep the old wage.</p>

      <p v-if="wageError" role="alert" class="text-sm text-debit">{{ wageError }}</p>

      <div v-if="wages.data.value?.length">
        <p class="text-sm font-semibold">Wage history</p>
        <ul class="mt-1 max-h-40 overflow-y-auto text-sm">
          <li
            v-for="w in wages.data.value"
            :key="w.id"
            class="flex justify-between gap-4 border-b border-rule py-1.5 last:border-0"
          >
            <span>From {{ day(w.effective_date) }}</span>
            <span class="tabular-nums">{{ peso(w.daily_rate) }}</span>
          </li>
        </ul>
      </div>

      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="dialog?.close()">Cancel</button>
        <button type="submit" class="btn" :disabled="wageSaving">
          {{ wageSaving ? 'Saving…' : 'Save wage' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

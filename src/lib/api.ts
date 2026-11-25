import { shallowRef, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

export type PeriodStatus = 'open' | 'processed' | 'released'

// NUMERIC columns arrive as strings from pg; dates as 'YYYY-MM-DD'.
export interface Period {
  id: number
  period_start: string
  period_end: string
  pay_date: string
  status: PeriodStatus
  payslips: number
  gross_pay: string
  total_deductions: string
  net_pay: string
}

export interface Employee {
  id: number
  employee_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  position: string
  department_name: string
  employment_status: string
  date_hired: string
  is_active: boolean
}

export interface Payslip {
  salary_id: number
  employee_no: string
  employee_name: string
  department_name: string
  payroll_period_id: number
  period_start: string
  period_end: string
  pay_date: string
  daily_rate: string
  days_worked: string
  overtime_hours: string
  basic_pay: string
  overtime_pay: string
  other_earnings: string
  total_deductions: string
  gross_pay: string
  net_pay: string
}

export interface Department {
  id: number
  department_code: string
  department_name: string
  is_active: boolean
  employees: number
  // 'HH:MM' or null (= anytime)
  time_in_start: string | null
  time_in_end: string | null
  time_out_start: string | null
  time_out_end: string | null
}

export interface EmployeeDetail {
  id: number
  employee_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  position: string
  department_id: number
  department_name: string
  employment_status: string
  date_hired: string
  contact_no: string | null
  sss_no: string | null
  philhealth_no: string | null
  pagibig_no: string | null
  tin: string | null
  is_active: boolean
  qr_token: string
}

export interface ScanLog {
  id: number
  log_type: 'in' | 'out'
  scanned_at: string
  employee_no: string
  name: string
  department_name: string
}

export interface ScanResult extends ScanLog {
  status: 'success' | 'duplicate'
}

export interface WageRate {
  id: number
  daily_rate: string
  effective_date: string
  remarks: string | null
}

export interface HoursRow {
  employee_id: number
  employee_no: string
  name: string
  department_name: string
  days_present: number
  hours_rendered: string
  paid_hours: string
  missing_out: number
  daily_rate: string
  days_worked: string
  basic_pay: string
}

export interface PeriodHours {
  period: Omit<Period, 'payslips' | 'gross_pay' | 'total_deductions' | 'net_pay'> & {
    rate: { daily_rate: number; effective_date: string } | null
  }
  rows: HoursRow[]
}

export interface LineItem {
  type_id?: number // earning or deduction type, for removing the line
  name: string
  amount: number
}

export interface MyPayslip extends Payslip {
  status: PeriodStatus
  position: string
  earnings: LineItem[]
  deductions: LineItem[]
}

export interface Profile {
  employee_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  position: string
  department_name: string
  employment_status: string
  date_hired: string
  contact_no: string | null
  sss_no: string | null
  philhealth_no: string | null
  pagibig_no: string | null
  tin: string | null
}

// Requests in flight (loads and saves). App.vue shows a loading bar while it is above 0.
export const pending = ref(0)

// Loads JSON from our API and re-fetches when the URL changes or reload() is called; a null URL waits.
export function useApi<T>(url: MaybeRefOrGetter<string | null>) {
  const data = shallowRef<T>()
  const error = ref('')
  const version = ref(0)
  let shown = '' // URL whose data is in `data`

  // `watch`, not `watchEffect`: only the URL and reload() may start a request. watchEffect also
  // tracked `pending` (read by pending.value++), so each request triggered the next, forever.
  watch(
    () => [toValue(url), version.value] as const,
    async ([target]) => {
      if (!target) return
      // Another URL (e.g. another date): drop the old data so pages never show stale rows.
      // reload() of the same URL keeps it on screen while refreshing.
      if (target !== shown) data.value = undefined
      error.value = ''
      pending.value++
      try {
        const res = await fetch(target)
        if (res.status === 401) return window.location.assign('/login') // session expired
        const body = await res.json().catch(() => null) // e.g. an HTML error page from a proxy
        if (target !== toValue(url)) return // a newer request replaced this one
        if (!res.ok || body === null) throw new Error(body?.error)
        data.value = body
        shown = target
      } catch (e) {
        error.value =
          e instanceof Error && e.message
            ? e.message
            : 'Could not load data. Check your connection, then reload the page.'
      } finally {
        pending.value--
      }
    },
    { immediate: true },
  )

  return { data, error, reload: () => version.value++ }
}

// Sends JSON (POST by default); returns { error } with the server's message, or { error: null, data } when it worked.
export async function post<T = unknown>(
  url: string,
  body: unknown,
  method = 'POST',
): Promise<{ error: string | null; data?: T }> {
  pending.value++
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (res.ok) return { error: null, data: json }
    if (res.status === 401) window.location.assign('/login')
    return { error: json?.error ?? 'Could not save. Try again.' }
  } catch {
    return { error: 'Cannot reach the server. Check your connection and try again.' }
  } finally {
    pending.value--
  }
}

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
export const peso = (value: string | number) => pesoFormat.format(Number(value))

const dateFormat = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
// Parse 'YYYY-MM-DD' as a local date; new Date('YYYY-MM-DD') is UTC and can show the previous day.
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}
export const day = (iso: string) => dateFormat.format(toDate(iso))
const timeFormat = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
})
// '06:00' -> '6:00 AM'
export const ampm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h! % 12 || 12}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`
}
export const clock = (iso: string | Date) => timeFormat.format(new Date(iso))

export const periodRange = (start: string, end: string) =>
  dateFormat.formatRange(toDate(start), toDate(end))

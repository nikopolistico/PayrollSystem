<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import QrScanner from 'qr-scanner'
import { clock, post, useApi, type ScanLog, type ScanResult } from '@/lib/api'
import { pairScans } from '@/lib/attendance'

const { data: logs, error: logsError, reload } = useApi<ScanLog[]>('/api/scanner/logs')
const visits = computed(() => pairScans(logs.value ?? []))
const people = computed(() => new Set(visits.value.map((v) => v.employee_no)).size)
const onDuty = computed(() => visits.value.filter((v) => v.time_in && !v.time_out).length)

type Banner =
  | { kind: 'success' | 'duplicate'; title: string; scan: ScanResult; detail?: string }
  | { kind: 'error'; title: string; detail: string }

const video = ref<HTMLVideoElement>()
const cameraError = ref('')
const banner = shallowRef<Banner>()
const now = ref(new Date())

// Row to highlight while the scan result shows: the scanned employee's newest visit.
const justScanned = computed(() => {
  const b = banner.value
  return b && b.kind !== 'error'
    ? visits.value.find((v) => v.employee_no === b.scan.employee_no)?.key
    : undefined
})

let scanner: QrScanner | undefined
let busy = false
let lastToken = ''
let lastAt = 0
let tick: number | undefined
let clearBanner: number | undefined

function show(next: Banner) {
  banner.value = next
  window.clearTimeout(clearBanner)
  clearBanner = window.setTimeout(() => (banner.value = undefined), 6000) // back to idle for the next person
}

async function onScan(token: string) {
  // The camera reads the same QR several times a second: one request at a time, and ignore
  // the same card for a few seconds. The server also refuses repeats within a minute.
  if (busy || (token === lastToken && Date.now() - lastAt < 4000)) return
  busy = true
  lastToken = token
  lastAt = Date.now()
  const res = await post<ScanResult>('/api/scanner/scan', { token })
  busy = false

  const scan = res.data
  if (!scan) return show({ kind: 'error', title: 'Scan failed', detail: res.error ?? 'Try again.' })
  if (scan.status === 'duplicate') {
    return show({
      kind: 'duplicate',
      title: 'Already scanned',
      scan,
      detail: `Time ${scan.log_type} was recorded at ${clock(scan.scanned_at)}. Wait a minute before scanning again.`,
    })
  }
  show({
    kind: 'success',
    title: scan.log_type === 'in' ? 'Time in recorded' : 'Time out recorded',
    scan,
  })
  reload()
}

onMounted(async () => {
  tick = window.setInterval(() => (now.value = new Date()), 1000)
  scanner = new QrScanner(video.value!, (r) => onScan(r.data), {
    preferredCamera: 'environment',
    highlightScanRegion: true,
    highlightCodeOutline: true,
    maxScansPerSecond: 5,
    returnDetailedScanResult: true,
  })
  try {
    await scanner.start()
  } catch {
    cameraError.value =
      'Camera not available. Allow camera access for this site in the browser, then reload the page.'
  }
})

onBeforeUnmount(() => {
  scanner?.destroy()
  window.clearInterval(tick)
  window.clearTimeout(clearBanner)
})
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="flex items-center justify-between gap-4 border-b-4 border-double border-rule px-4 py-3 md:px-8"
    >
      <div>
        <p class="font-bold tracking-tight">Payroll System</p>
        <p class="text-sm text-muted">Attendance portal</p>
      </div>
      <p class="text-2xl font-bold tabular-nums md:text-3xl">{{ clock(now) }}</p>
      <RouterLink to="/login" class="text-sm font-semibold text-ledger hover:underline">
        Back to sign in
      </RouterLink>
    </header>

    <main
      class="mx-auto grid max-w-7xl items-start gap-6 px-4 py-6 md:px-8 lg:grid-cols-[18rem_minmax(0,1fr)]"
    >
      <!-- Small camera + last result; sticks while the table scrolls -->
      <section aria-label="Scanner" class="mx-auto w-full max-w-72 lg:sticky lg:top-6">
        <div class="relative overflow-hidden rounded-lg bg-ink">
          <video ref="video" class="aspect-square w-full object-cover" muted playsinline></video>
          <p
            v-if="cameraError"
            role="alert"
            class="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white"
          >
            {{ cameraError }}
          </p>
        </div>

        <!-- Result of the last scan; announced to screen readers -->
        <div
          role="status"
          aria-live="polite"
          class="mt-3 rounded-lg p-4"
          :class="{
            'border border-rule bg-sheet': !banner,
            'bg-ledger text-white': banner?.kind === 'success',
            'border-2 border-ink bg-sheet': banner?.kind === 'duplicate',
            'bg-debit text-white': banner?.kind === 'error',
          }"
        >
          <template v-if="!banner">
            <p class="font-bold">Ready to scan</p>
            <p class="mt-0.5 text-sm text-muted">Hold your QR code in front of the camera.</p>
          </template>
          <template v-else>
            <p class="text-sm font-semibold">{{ banner.title }}</p>
            <template v-if="banner.kind !== 'error'">
              <p class="mt-0.5 text-xl leading-tight font-bold">{{ banner.scan.name }}</p>
              <p
                class="text-sm"
                :class="banner.kind === 'success' ? 'text-white/85' : 'text-muted'"
              >
                {{ banner.scan.department_name }}
                <template v-if="banner.kind === 'success'">
                  <br />Time {{ banner.scan.log_type }} at {{ clock(banner.scan.scanned_at) }}
                </template>
              </p>
            </template>
            <p v-if="banner.detail" class="mt-1 text-sm">{{ banner.detail }}</p>
          </template>
        </div>
      </section>

      <section aria-labelledby="today" class="min-w-0">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="today" class="text-lg font-bold">Today's attendance</h2>
          <p v-if="visits.length" class="text-sm text-muted">
            {{ people }} {{ people === 1 ? 'employee' : 'employees' }} timed in, {{ onDuty }} still
            on duty
          </p>
        </div>
        <p v-if="logsError" role="alert" class="mt-2 text-sm text-debit">{{ logsError }}</p>

        <div class="mt-3 overflow-x-auto rounded-lg border border-rule bg-sheet">
          <table class="ledger">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Time in</th>
                <th>Time out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="v in visits"
                :key="v.key"
                class="transition-colors motion-reduce:transition-none"
                :class="{ 'bg-ledger/8': v.key === justScanned }"
              >
                <td>
                  <span class="block font-semibold">{{ v.name }}</span>
                  <span class="block text-xs text-muted tabular-nums">{{ v.employee_no }}</span>
                </td>
                <td>{{ v.department_name }}</td>
                <td class="tabular-nums">{{ v.time_in ? clock(v.time_in) : '–' }}</td>
                <td class="tabular-nums" :class="{ 'text-muted': !v.time_out }">
                  {{ v.time_out ? clock(v.time_out) : v.time_in ? 'On duty' : '–' }}
                </td>
                <td>
                  <span
                    class="inline-block rounded-full bg-ledger px-2.5 py-0.5 text-xs font-semibold text-white"
                  >
                    Successful
                  </span>
                </td>
              </tr>
              <tr v-if="logs && !visits.length">
                <td colspan="5" class="py-10 text-center whitespace-normal text-muted">
                  No one has timed in yet today. Scans show here as they happen.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import { useApi, type EmployeeDetail } from '@/lib/api'

const route = useRoute()
const {
  data: emp,
  error,
} = useApi<EmployeeDetail>(() => `/api/admin/employees/${route.params.id}`)

// SVG made locally from our own token, so v-html below is safe.
const svg = ref('')
watchEffect(async () => {
  if (!emp.value) return
  svg.value = await QRCode.toString(emp.value.qr_token, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#10261f', light: '#ffffff' },
  })
})

const print = () => window.print()
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <div v-if="emp" class="grid justify-items-start gap-6">
    <p v-if="route.query.registered" role="status" class="text-ledger print:hidden">
      {{ emp.first_name }} {{ emp.last_name }} registered. Print this QR card and give it to them.
    </p>

    <!-- The card: about ID size when printed -->
    <article class="w-72 rounded-lg border border-rule bg-sheet p-6 text-center print:border-ink">
      <p class="text-sm font-semibold text-muted">Attendance QR</p>
      <div
        class="mx-auto mt-4 size-48 [&>svg]:size-full"
        role="img"
        :aria-label="`QR code for ${emp.employee_no}`"
        v-html="svg"
      />
      <p class="mt-5 text-lg leading-tight font-bold">{{ emp.first_name }} {{ emp.last_name }}</p>
      <p class="mt-1 text-sm text-muted">{{ emp.position }}</p>
      <p class="text-sm text-muted">{{ emp.department_name }}</p>
      <p class="mt-3 font-semibold tabular-nums">{{ emp.employee_no }}</p>
    </article>

    <div class="flex flex-wrap items-center gap-4 print:hidden">
      <button type="button" class="btn" @click="print">Print QR card</button>
      <RouterLink to="/admin/employees" class="font-semibold text-muted hover:text-ink">
        Back to employees
      </RouterLink>
    </div>

    <p class="max-w-prose text-sm text-muted print:hidden">
      The employee shows this QR at the attendance scanner to record time in and time out. Anyone
      holding this QR can scan for this employee, so it should stay with them.
    </p>
  </div>
</template>

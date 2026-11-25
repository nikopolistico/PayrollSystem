<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import LinesDialog from '@/components/LinesDialog.vue'
import PayslipSheet from '@/components/PayslipSheet.vue'
import { useApi, type MyPayslip } from '@/lib/api'

const route = useRoute()
const {
  data: s,
  error,
  reload,
} = useApi<MyPayslip>(() => `/api/admin/payslips/${route.params.id}`)

// Earnings and deductions are edited in modals so this page stays on the payslip itself.
const earningsBox = ref<InstanceType<typeof LinesDialog>>()
const deductionsBox = ref<InstanceType<typeof LinesDialog>>()

const print = () => window.print()
</script>

<template>
  <div class="min-h-dvh px-4 py-6 print:p-0">
    <div
      class="mx-auto mb-4 flex max-w-[297mm] flex-wrap items-center justify-between gap-4 print:hidden"
    >
      <RouterLink
        :to="s ? `/admin/payslips?period=${s.payroll_period_id}` : '/admin/payslips'"
        class="font-semibold text-ledger hover:underline"
      >
        Back to payslips
      </RouterLink>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="s?.status === 'open'">
          <button type="button" class="btn-outline" @click="earningsBox?.open()">
            <Icon name="plus" />
            Earnings
          </button>
          <button type="button" class="btn-outline" @click="deductionsBox?.open()">
            <Icon name="plus" />
            Deductions
          </button>
        </template>
        <p v-else-if="s" class="text-sm text-muted">
          This week is {{ s.status }}, so this payslip is locked.
        </p>
        <button type="button" class="btn" :disabled="!s" @click="print">Print payslip</button>
      </div>
    </div>
    <p class="mx-auto -mt-2 mb-4 max-w-[297mm] text-sm text-muted print:hidden">
      A4 landscape, two copies. Cut along the dashed line.
    </p>

    <p v-if="error" role="alert" class="text-center text-debit">{{ error }}</p>

    <!-- One A4 landscape sheet: two identical copies side by side -->
    <div v-if="s" class="overflow-x-auto print:overflow-visible">
      <PayslipSheet :s="s" />
    </div>
  </div>
  <template v-if="s">
    <LinesDialog
      ref="earningsBox"
      kind="earnings"
      :salary-id="s.salary_id"
      :lines="s.earnings"
      @changed="reload"
    />
    <LinesDialog
      ref="deductionsBox"
      kind="deductions"
      :salary-id="s.salary_id"
      :lines="s.deductions"
      @changed="reload"
    />
  </template>
</template>

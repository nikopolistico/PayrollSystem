<script setup lang="ts">
import { computed } from 'vue'
import { day, useApi, type Profile } from '@/lib/api'

const { data: me, error } = useApi<Profile>('/api/employee/profile')

const work = computed(() =>
  me.value
    ? [
        ['Employee no.', me.value.employee_no],
        ['Position', me.value.position],
        ['Department', me.value.department_name],
        ['Employment', me.value.employment_status.replace(/^./, (c) => c.toUpperCase())],
        ['Date hired', day(me.value.date_hired)],
        ['Contact no.', me.value.contact_no],
      ]
    : [],
)
const ids = computed(() =>
  me.value
    ? [
        ['SSS', me.value.sss_no],
        ['PhilHealth', me.value.philhealth_no],
        ['Pag-IBIG', me.value.pagibig_no],
        ['TIN', me.value.tin],
      ]
    : [],
)
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <div v-if="me" class="grid max-w-3xl gap-8">
    <p class="text-xl font-semibold">
      {{ me.first_name }} {{ me.middle_name ?? '' }} {{ me.last_name }}
    </p>

    <section
      v-for="group in [
        { title: 'Work details', rows: work },
        { title: 'Government IDs', rows: ids },
      ]"
      :key="group.title"
      :aria-label="group.title"
    >
      <h2 class="text-lg font-bold">{{ group.title }}</h2>
      <dl class="mt-3 rounded-lg border border-rule bg-sheet">
        <div
          v-for="[label, value] in group.rows"
          :key="label!"
          class="grid gap-1 border-b border-rule px-4 py-3 last:border-0 sm:grid-cols-[12rem_1fr]"
        >
          <dt class="text-sm text-muted">{{ label }}</dt>
          <dd :class="value ? 'tabular-nums' : 'text-muted'">{{ value || 'Not on file' }}</dd>
        </div>
      </dl>
    </section>

    <p class="text-sm text-muted">Something wrong or missing? Ask HR to update your record.</p>
  </div>
</template>

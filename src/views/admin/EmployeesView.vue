<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import Icon from '@/components/Icon.vue'
import StatusTag from '@/components/StatusTag.vue'
import { day, post, useApi, type Employee } from '@/lib/api'

const route = useRoute()
const { data: employees, error, reload } = useApi<Employee[]>('/api/admin/employees')
const message = ref(route.query.saved ? `${route.query.saved} saved.` : '')

// Delete with confirmation
const confirmBox = ref<InstanceType<typeof ConfirmDialog>>()
const toDelete = ref<Employee>()
const deleting = ref(false)
const deleteError = ref('')

function askDelete(e: Employee) {
  toDelete.value = e
  deleteError.value = ''
  confirmBox.value?.open()
}

async function confirmDelete() {
  const e = toDelete.value!
  deleting.value = true
  const res = await post(`/api/admin/employees/${e.id}`, {}, 'DELETE')
  deleting.value = false
  deleteError.value = res.error ?? ''
  if (res.error) return
  confirmBox.value?.close()
  message.value = `${e.first_name} ${e.last_name} deleted.`
  reload()
}
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <Teleport defer to="#page-actions">
    <RouterLink to="/admin/employees/new" class="btn"
      ><Icon name="plus" /> Register employee</RouterLink
    >
  </Teleport>
  <p v-if="message" role="status" class="mb-4 text-sm text-ledger">{{ message }}</p>

  <div class="overflow-x-auto rounded-lg border border-rule bg-sheet">
    <table class="ledger">
      <thead>
        <tr>
          <th>Employee no.</th>
          <th>Name</th>
          <th>Position</th>
          <th>Department</th>
          <th>Employment</th>
          <th>Date hired</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in employees" :key="e.id" :class="{ 'text-muted': !e.is_active }">
          <td class="tabular-nums">{{ e.employee_no }}</td>
          <td class="font-medium">
            {{ e.last_name }}, {{ e.first_name }}
            {{ e.middle_name?.[0] ? `${e.middle_name[0]}.` : '' }}
            <StatusTag v-if="!e.is_active" status="inactive" class="ml-2" />
          </td>
          <td>{{ e.position }}</td>
          <td>{{ e.department_name }}</td>
          <td class="capitalize">{{ e.employment_status }}</td>
          <td>{{ day(e.date_hired) }}</td>
          <td>
            <div class="flex justify-end gap-1">
              <RouterLink
                :to="`/admin/employees/${e.id}/qr`"
                class="icon-btn"
                :aria-label="`QR code of ${e.first_name} ${e.last_name}`"
                :title="`QR code of ${e.first_name} ${e.last_name}`"
              >
                <Icon name="qr" />
              </RouterLink>
              <RouterLink
                :to="`/admin/employees/${e.id}/edit`"
                class="icon-btn"
                :aria-label="`Edit ${e.first_name} ${e.last_name}`"
                :title="`Edit ${e.first_name} ${e.last_name}`"
              >
                <Icon name="edit" />
              </RouterLink>
              <button
                type="button"
                class="icon-btn danger"
                :aria-label="`Delete ${e.first_name} ${e.last_name}`"
                :title="`Delete ${e.first_name} ${e.last_name}`"
                @click="askDelete(e)"
              >
                <Icon name="trash" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="employees && !employees.length">
          <td colspan="7" class="py-10 text-center whitespace-normal text-muted">
            No employees yet. Register your first employee to get started.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <ConfirmDialog
    ref="confirmBox"
    title="Delete this employee?"
    confirm-label="Delete employee"
    :busy="deleting"
    :error="deleteError"
    @confirm="confirmDelete"
  >
    <template v-if="toDelete">
      <dl class="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt class="text-muted">Employee</dt>
        <dd class="font-semibold">{{ toDelete.first_name }} {{ toDelete.last_name }}</dd>
        <dt class="text-muted">Employee no.</dt>
        <dd class="tabular-nums">{{ toDelete.employee_no }}</dd>
        <dt class="text-muted">Department</dt>
        <dd>{{ toDelete.department_name }}</dd>
      </dl>
      <p class="text-sm text-muted">
        Their portal login and QR code are deleted too. Employees with attendance or payslips can't
        be deleted; edit them and uncheck Active instead.
      </p>
    </template>
  </ConfirmDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useId } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import Icon from '@/components/Icon.vue'
import { clock, day, post, useApi, type ScanLog } from '@/lib/api'
import { pairScans, type Visit } from '@/lib/attendance'

// Today in the Philippines, as YYYY-MM-DD (sv-SE formats dates that way).
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' })
const date = ref(today)
const {
  data: logs,
  error,
  reload,
} = useApi<ScanLog[]>(() => (date.value ? `/api/admin/attendance?date=${date.value}` : null))

// One table per department, each listing that day's visits (time in / time out pairs).
const departments = computed(() => {
  const groups = new Map<string, ReturnType<typeof pairScans>>()
  for (const v of pairScans(logs.value ?? []).reverse()) {
    groups.set(v.department_name, [...(groups.get(v.department_name) ?? []), v])
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
})

// Delete with a confirmation box that names exactly what goes.
const confirmBox = ref<InstanceType<typeof ConfirmDialog>>()
const toDelete = ref<Visit>()
const deleting = ref(false)
const deleteError = ref('')
const deleted = ref('')

function askDelete(v: Visit) {
  toDelete.value = v
  deleteError.value = ''
  confirmBox.value?.open()
}

async function confirmDelete() {
  const v = toDelete.value!
  deleting.value = true
  const res = await post(
    '/api/admin/attendance',
    { ids: [v.in_id, v.out_id].filter(Boolean) },
    'DELETE',
  )
  deleting.value = false
  deleteError.value = res.error ?? ''
  if (res.error) return
  confirmBox.value?.close()
  deleted.value = `Deleted ${v.name}'s attendance. If this week's payslips were saved, save them again.`
  reload()
}

// Edit modal: fix a visit's time in / time out (e.g. fill in a forgotten time out).
const editBox = ref<HTMLDialogElement>()
const editTitle = useId()
const toEdit = ref<Visit>()
const times = reactive({ time_in: '', time_out: '' })
const saving = ref(false)
const editError = ref('')
// ISO timestamp -> 'HH:MM' in Philippine time, for <input type="time">
const hhmm = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

function askEdit(v: Visit) {
  toEdit.value = v
  times.time_in = hhmm(v.time_in)
  times.time_out = hhmm(v.time_out)
  editError.value = ''
  editBox.value?.showModal()
}

async function saveEdit() {
  const v = toEdit.value!
  saving.value = true
  const res = await post(
    '/api/admin/attendance',
    { date: date.value, employee_no: v.employee_no, in_id: v.in_id, out_id: v.out_id, ...times },
    'PUT',
  )
  saving.value = false
  editError.value = res.error ?? ''
  if (res.error) return
  editBox.value?.close()
  deleted.value = `Saved ${v.name}'s attendance. If this week's payslips were saved, save them again.`
  reload()
}

const hours = (from?: string, to?: string) =>
  from && to ? ((Date.parse(to) - Date.parse(from)) / 3_600_000).toFixed(2) : '–'
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <label class="field w-48">
      Date
      <input v-model="date" type="date" :max="today" />
    </label>
    <p v-if="logs?.length" class="text-sm text-muted">
      {{ new Set(logs.map((l) => l.employee_no)).size }} employees scanned on {{ day(date) }}
    </p>
  </div>

  <p v-if="error" role="alert" class="mt-6 text-debit">{{ error }}</p>
  <p v-if="deleted" role="status" class="mt-6 text-ledger">{{ deleted }}</p>

  <p v-if="logs && !logs.length" class="mt-8 text-muted">
    No one scanned on {{ day(date) }}. Pick another date.
  </p>

  <section
    v-for="[dept, visits] in departments"
    :key="dept"
    class="mt-8"
    :aria-labelledby="`dept-${dept}`"
  >
    <h2 :id="`dept-${dept}`" class="text-lg font-bold">
      {{ dept }}
      <span class="text-sm font-normal text-muted">
        {{ new Set(visits.map((v) => v.employee_no)).size }} timed in
      </span>
    </h2>
    <div class="mt-3 overflow-x-auto rounded-lg border border-rule bg-sheet">
      <table class="ledger">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Time in</th>
            <th>Time out</th>
            <th class="num">Hours</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in visits" :key="v.key">
            <td>
              <span class="block font-semibold">{{ v.name }}</span>
              <span class="block text-xs text-muted tabular-nums">{{ v.employee_no }}</span>
            </td>
            <td class="tabular-nums">{{ v.time_in ? clock(v.time_in) : '–' }}</td>
            <td class="tabular-nums" :class="{ 'text-debit': v.time_in && !v.time_out }">
              {{
                v.time_out
                  ? clock(v.time_out)
                  : v.time_in
                    ? date === today
                      ? 'On duty'
                      : 'No time out'
                    : '–'
              }}
            </td>
            <td class="num">{{ hours(v.time_in, v.time_out) }}</td>
            <td>
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  class="icon-btn"
                  :aria-label="`Edit attendance of ${v.name}`"
                  :title="`Edit attendance of ${v.name}`"
                  @click="askEdit(v)"
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  :aria-label="`Delete attendance of ${v.name}`"
                  :title="`Delete attendance of ${v.name}`"
                  @click="askDelete(v)"
                >
                  <Icon name="trash" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <ConfirmDialog
    ref="confirmBox"
    title="Delete this attendance?"
    confirm-label="Delete attendance"
    :busy="deleting"
    :error="deleteError"
    @confirm="confirmDelete"
  >
    <template v-if="toDelete">
      <dl class="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt class="text-muted">Employee</dt>
        <dd class="font-semibold">{{ toDelete.name }}</dd>
        <dt class="text-muted">Date</dt>
        <dd>{{ day(date) }}</dd>
        <dt class="text-muted">Time in</dt>
        <dd class="tabular-nums">{{ toDelete.time_in ? clock(toDelete.time_in) : '–' }}</dd>
        <dt class="text-muted">Time out</dt>
        <dd class="tabular-nums">{{ toDelete.time_out ? clock(toDelete.time_out) : '–' }}</dd>
      </dl>
      <p class="text-sm text-muted">
        These hours will no longer count toward pay. This can't be undone.
      </p>
    </template>
  </ConfirmDialog>

  <dialog
    ref="editBox"
    :aria-labelledby="editTitle"
    class="modal max-w-sm"
    @click.self="editBox?.close()"
  >
    <form v-if="toEdit" class="grid gap-4 p-5 md:p-6" @submit.prevent="saveEdit">
      <div>
        <h2 :id="editTitle" class="text-xl font-bold">Edit attendance</h2>
        <p class="mt-1 text-sm text-muted">{{ toEdit.name }}, {{ day(date) }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="field">
          Time in
          <input v-model="times.time_in" type="time" required />
        </label>
        <label class="field">
          <span>Time out <small>(optional)</small></span>
          <input v-model="times.time_out" type="time" :min="times.time_in" />
        </label>
      </div>
      <p class="text-sm text-muted">
        Leave time out blank if they haven't left yet. It must be later than time in.
      </p>
      <p v-if="editError" role="alert" class="text-sm text-debit">{{ editError }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="editBox?.close()">Cancel</button>
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save attendance' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { reactive, ref, useId, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import Icon from '@/components/Icon.vue'
import StatusTag from '@/components/StatusTag.vue'
import { acronym } from '@/lib/acronym'
import { ampm, post, useApi, type Department } from '@/lib/api'

const { data: departments, error, reload } = useApi<Department[]>('/api/admin/departments')

// "Add department" modal. The code fills itself from the name's acronym until you type your own
// (erasing the code turns auto-fill back on).
const addBox = ref<HTMLDialogElement>()
const addTitle = useId()
const code = ref('')
const name = ref('')
const codeTyped = ref(false)
const saving = ref(false)
const formError = ref('')
const message = ref('')
watch(name, (n) => {
  if (!codeTyped.value) code.value = acronym(n)
})

function openAdd() {
  name.value = code.value = formError.value = ''
  codeTyped.value = false
  addBox.value?.showModal()
}

async function add() {
  saving.value = true
  message.value = ''
  formError.value =
    (
      await post('/api/admin/departments', {
        department_code: code.value,
        department_name: name.value,
      })
    ).error ?? ''
  saving.value = false
  if (formError.value) return
  addBox.value?.close()
  message.value = `${name.value} added. Use the edit icon to set when its employees can scan.`
  reload()
}

// Edit modal: code, name and when its employees may scan.
const editBox = ref<HTMLDialogElement>()
const editTitle = useId()
const editing = ref<number | null>(null)
const form = reactive({
  department_code: '',
  department_name: '',
  time_in_start: '',
  time_in_end: '',
  time_out_start: '',
  time_out_end: '',
})
const editError = ref('')

function edit(d: Department) {
  editing.value = d.id
  editError.value = ''
  Object.assign(form, {
    department_code: d.department_code,
    department_name: d.department_name,
    time_in_start: d.time_in_start ?? '',
    time_in_end: d.time_in_end ?? '',
    time_out_start: d.time_out_start ?? '',
    time_out_end: d.time_out_end ?? '',
  })
  editBox.value?.showModal()
}

async function saveEdit() {
  saving.value = true
  editError.value =
    (await post(`/api/admin/departments/${editing.value}`, form, 'PATCH')).error ?? ''
  saving.value = false
  if (editError.value) return
  message.value = `${form.department_name} saved.`
  editBox.value?.close()
  reload()
}

// Delete with confirmation
const confirmBox = ref<InstanceType<typeof ConfirmDialog>>()
const toDelete = ref<Department>()
const deleting = ref(false)
const deleteError = ref('')

function askDelete(d: Department) {
  toDelete.value = d
  deleteError.value = ''
  confirmBox.value?.open()
}

async function confirmDelete() {
  deleting.value = true
  const res = await post(`/api/admin/departments/${toDelete.value!.id}`, {}, 'DELETE')
  deleting.value = false
  deleteError.value = res.error ?? ''
  if (res.error) return
  confirmBox.value?.close()
  message.value = `${toDelete.value!.department_name} deleted.`
  reload()
}

const range = (start: string | null, end: string | null) =>
  start && end ? `${ampm(start)} – ${ampm(end)}` : 'Anytime'
</script>

<template>
  <p v-if="error" role="alert" class="mb-6 text-debit">{{ error }}</p>

  <Teleport defer to="#page-actions">
    <button type="button" class="btn" @click="openAdd">
      <Icon name="plus" />
      Add department
    </button>
  </Teleport>
  <p v-if="message" role="status" class="mb-4 text-sm text-ledger">{{ message }}</p>

  <div class="overflow-x-auto rounded-lg border border-rule bg-sheet">
    <table class="ledger">
      <thead>
        <tr>
          <th>Code</th>
          <th>Department</th>
          <th>Time in allowed</th>
          <th>Time out allowed</th>
          <th class="num">Employees</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in departments" :key="d.id" :class="{ 'text-muted': !d.is_active }">
          <td class="font-medium">{{ d.department_code }}</td>
          <td>
            {{ d.department_name }}
            <StatusTag v-if="!d.is_active" status="inactive" class="ml-2" />
          </td>
          <td :class="{ 'text-muted': !d.time_in_start }">
            {{ range(d.time_in_start, d.time_in_end) }}
          </td>
          <td :class="{ 'text-muted': !d.time_out_start }">
            {{ range(d.time_out_start, d.time_out_end) }}
          </td>
          <td class="num">{{ d.employees }}</td>
          <td>
            <div class="flex justify-end gap-1">
              <button
                type="button"
                class="icon-btn"
                :aria-label="`Edit ${d.department_name}`"
                :title="`Edit ${d.department_name}`"
                @click="edit(d)"
              >
                <Icon name="edit" />
              </button>
              <button
                type="button"
                class="icon-btn danger"
                :aria-label="`Delete ${d.department_name}`"
                :title="`Delete ${d.department_name}`"
                @click="askDelete(d)"
              >
                <Icon name="trash" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="departments && !departments.length">
          <td colspan="6" class="py-10 text-center whitespace-normal text-muted">
            No departments yet. Add your first one above, then you can register employees to it.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <ConfirmDialog
    ref="confirmBox"
    title="Delete this department?"
    confirm-label="Delete department"
    :busy="deleting"
    :error="deleteError"
    @confirm="confirmDelete"
  >
    <template v-if="toDelete">
      <dl class="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
        <dt class="text-muted">Department</dt>
        <dd class="font-semibold">
          {{ toDelete.department_name }} ({{ toDelete.department_code }})
        </dd>
        <dt class="text-muted">Employees</dt>
        <dd>{{ toDelete.employees }}</dd>
      </dl>
      <p class="text-sm text-muted">
        {{
          toDelete.employees
            ? 'It still has employees, so it can only be deleted after they move to another department.'
            : "This can't be undone."
        }}
      </p>
    </template>
  </ConfirmDialog>

  <dialog
    ref="addBox"
    :aria-labelledby="addTitle"
    class="modal max-w-md"
    @click.self="addBox?.close()"
  >
    <form class="grid gap-4 p-5 md:p-6" @submit.prevent="add">
      <h2 :id="addTitle" class="text-xl font-bold">Add department</h2>
      <label class="field">
        Department name
        <input v-model="name" required maxlength="100" placeholder="Operations" autofocus />
      </label>
      <label class="field">
        <span>Code <small>(made from the name; you can change it)</small></span>
        <input
          v-model="code"
          required
          maxlength="20"
          class="uppercase"
          @input="codeTyped = ($event.target as HTMLInputElement).value !== ''"
        />
      </label>
      <p v-if="formError" role="alert" class="text-sm text-debit">{{ formError }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="addBox?.close()">Cancel</button>
        <button type="submit" class="btn" :disabled="saving">
          <Icon name="plus" />
          {{ saving ? 'Adding…' : 'Add department' }}
        </button>
      </div>
    </form>
  </dialog>

  <dialog
    ref="editBox"
    :aria-labelledby="editTitle"
    class="modal max-w-md"
    @click.self="editBox?.close()"
  >
    <form class="grid gap-4 p-5 md:p-6" @submit.prevent="saveEdit">
      <h2 :id="editTitle" class="text-xl font-bold">Edit department</h2>
      <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label class="field">
          Code
          <input v-model="form.department_code" required maxlength="20" class="uppercase" />
        </label>
        <label class="field">
          Department name
          <input v-model="form.department_name" required maxlength="100" />
        </label>
      </div>
      <fieldset v-for="kind in ['in', 'out'] as const" :key="kind" class="grid grid-cols-2 gap-3">
        <legend class="mb-2 text-sm font-semibold">Time {{ kind }} allowed</legend>
        <label class="field">
          From
          <input v-model="form[`time_${kind}_start`]" type="time" />
        </label>
        <label class="field">
          Until
          <input v-model="form[`time_${kind}_end`]" type="time" />
        </label>
      </fieldset>
      <p class="text-sm text-muted">
        Leave both times blank to allow any time. A start later than the end crosses midnight, for
        night shifts.
      </p>
      <p v-if="editError" role="alert" class="text-sm text-debit">{{ editError }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="editBox?.close()">Cancel</button>
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save department' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

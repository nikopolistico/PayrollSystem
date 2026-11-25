<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { post, useApi, type Department, type EmployeeDetail } from '@/lib/api'

const route = useRoute()
const router = useRouter()
// Same form for Register (/admin/employees/new) and Edit (/admin/employees/:id/edit).
const editId = route.params.id ? Number(route.params.id) : null
const { data: departments, error: departmentsError } =
  useApi<Department[]>('/api/admin/departments')
const activeDepartments = computed(() => departments.value?.filter((d) => d.is_active) ?? [])

const form = reactive({
  employee_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  position: '',
  department_id: '',
  employment_status: 'probationary',
  date_hired: '',
  contact_no: '',
  sss_no: '',
  philhealth_no: '',
  pagibig_no: '',
  tin: '',
  email: '',
  password: '',
  is_active: true,
})
type Key = Exclude<keyof typeof form, 'is_active'>

// Edit: the form stays locked until the employee's details are in, so Save can't write blanks over them.
const ready = ref(!editId)
const loadError = ref('')
if (editId) {
  const { data: current, error: currentError } = useApi<EmployeeDetail>(
    `/api/admin/employees/${editId}`,
  )
  // Blank optional fields arrive as null; inputs show them empty and the server reads null as blank.
  watch(current, (e) => {
    if (!e) return
    Object.assign(form, e)
    ready.value = true
  })
  watch(currentError, (e) => (loadError.value = e))
}

const personal: { key: Key; label: string; optional?: boolean; max: number }[] = [
  { key: 'first_name', label: 'First name', max: 50 },
  { key: 'middle_name', label: 'Middle name', optional: true, max: 50 },
  { key: 'last_name', label: 'Last name', max: 50 },
  { key: 'contact_no', label: 'Contact no.', optional: true, max: 15 },
]
const govIds: { key: Key; label: string }[] = [
  { key: 'sss_no', label: 'SSS no.' },
  { key: 'philhealth_no', label: 'PhilHealth no.' },
  { key: 'pagibig_no', label: 'Pag-IBIG no.' },
  { key: 'tin', label: 'TIN' },
]

const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  const res = editId
    ? await post(`/api/admin/employees/${editId}`, form, 'PUT')
    : await post<{ id: number }>('/api/admin/employees', form)
  saving.value = false
  error.value = res.error ?? ''
  if (res.error) return
  if (editId)
    router.push({
      path: '/admin/employees',
      query: { saved: `${form.first_name} ${form.last_name}` },
    })
  // New employee: straight to their QR card so it can be printed.
  else
    router.push({
      path: `/admin/employees/${(res.data as { id: number }).id}/qr`,
      query: { registered: '1' },
    })
}
</script>

<template>
  <p v-if="loadError || departmentsError" role="alert" class="mb-6 text-debit">
    {{ loadError || departmentsError }}
  </p>
  <form
    class="grid max-w-3xl gap-8"
    :inert="!ready"
    :class="{ 'opacity-50': !ready }"
    @submit.prevent="save"
  >
    <section aria-labelledby="personal">
      <h2 id="personal" class="text-lg font-bold">Personal details</h2>
      <div class="mt-3 grid gap-4 rounded-lg border border-rule bg-sheet p-4 sm:grid-cols-2 md:p-6">
        <label v-for="f in personal" :key="f.key" class="field">
          <span>{{ f.label }} <small v-if="f.optional">(optional)</small></span>
          <input
            v-model="form[f.key]"
            :required="!f.optional"
            :maxlength="f.max"
            :type="f.key === 'contact_no' ? 'tel' : 'text'"
          />
        </label>
      </div>
    </section>

    <section aria-labelledby="work">
      <h2 id="work" class="text-lg font-bold">Work</h2>
      <div class="mt-3 grid gap-4 rounded-lg border border-rule bg-sheet p-4 sm:grid-cols-2 md:p-6">
        <label class="field">
          Employee no.
          <input
            v-model="form.employee_no"
            required
            maxlength="20"
            placeholder="EMP001"
            class="uppercase"
          />
        </label>
        <label class="field">
          Position
          <input v-model="form.position" required maxlength="100" />
        </label>
        <label class="field">
          Department
          <select v-model="form.department_id" required>
            <option value="" disabled>Choose a department</option>
            <option v-for="d in activeDepartments" :key="d.id" :value="d.id">
              {{ d.department_name }} ({{ d.department_code }})
            </option>
          </select>
          <small v-if="departments && !activeDepartments.length">
            No departments yet.
            <RouterLink to="/admin/departments" class="font-semibold text-ledger underline">
              Add a department
            </RouterLink>
            first.
          </small>
        </label>
        <label class="field">
          Employment status
          <select v-model="form.employment_status" required>
            <option value="regular">Regular</option>
            <option value="probationary">Probationary</option>
            <option value="contractual">Contractual</option>
          </select>
        </label>
        <label class="field">
          Date hired
          <input v-model="form.date_hired" type="date" required />
        </label>
        <label v-if="editId" class="flex items-center gap-2 self-end pb-2.5 text-sm font-medium">
          <input v-model="form.is_active" type="checkbox" class="size-4 accent-ledger" />
          Active (unchecked = no longer working here; their QR stops working)
        </label>
      </div>
    </section>

    <section aria-labelledby="ids">
      <h2 id="ids" class="text-lg font-bold">
        Government IDs <small class="text-sm font-normal text-muted">(optional)</small>
      </h2>
      <div class="mt-3 grid gap-4 rounded-lg border border-rule bg-sheet p-4 sm:grid-cols-2 md:p-6">
        <label v-for="f in govIds" :key="f.key" class="field">
          {{ f.label }}
          <input v-model="form[f.key]" maxlength="20" />
        </label>
      </div>
    </section>

    <section v-if="!editId" aria-labelledby="login">
      <h2 id="login" class="text-lg font-bold">
        Portal login <small class="text-sm font-normal text-muted">(optional)</small>
      </h2>
      <p class="mt-1 max-w-prose text-sm text-muted">
        Give the employee an email and password so they can sign in and see their payslips. Leave
        blank to skip.
      </p>
      <div class="mt-3 grid gap-4 rounded-lg border border-rule bg-sheet p-4 sm:grid-cols-2 md:p-6">
        <label class="field">
          Email
          <input v-model="form.email" type="email" autocomplete="off" maxlength="255" />
        </label>
        <label class="field">
          <span>Password <small>(at least 8 characters)</small></span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            :required="!!form.email.trim()"
          />
        </label>
      </div>
    </section>

    <p v-if="error" role="alert" class="text-debit">{{ error }}</p>

    <div class="flex flex-wrap items-center gap-4">
      <button type="submit" class="btn" :disabled="saving || !ready">
        {{ saving ? 'Saving…' : editId ? 'Save changes' : 'Register employee' }}
      </button>
      <RouterLink to="/admin/employees" class="font-semibold text-muted hover:text-ink"
        >Cancel</RouterLink
      >
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, type Role } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const role = ref<Role>('employee')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  error.value = (await auth.login(role.value, email.value, password.value)) ?? ''
  loading.value = false
  if (!error.value) router.push(`/${role.value}`)
}
</script>

<template>
  <main class="grid min-h-dvh place-items-center px-4 py-10">
    <div class="w-full max-w-sm">
      <p class="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span
          class="grid size-10 place-items-center rounded-lg bg-ledger text-xl text-white"
          aria-hidden="true"
          >₱</span
        >
        Payroll System
      </p>

      <form
        class="mt-4 grid gap-5 rounded-lg border border-rule border-t-4 border-t-ledger bg-sheet p-6 md:p-8"
        @submit.prevent="submit"
      >
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Sign in</h1>
          <p class="mt-1 text-sm text-muted">Use the email your HR office registered.</p>
        </div>

        <fieldset
          class="grid grid-cols-2 gap-1 rounded-md bg-paper p-1 ring-1 ring-rule ring-inset"
        >
          <legend class="sr-only">Sign in as</legend>
          <label
            v-for="option in [
              { value: 'employee', label: 'Employee' },
              { value: 'admin', label: 'Admin' },
            ]"
            :key="option.value"
            class="cursor-pointer rounded px-3 py-2 text-center text-sm font-semibold text-muted has-checked:bg-sheet has-checked:text-ink has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-ledger"
          >
            <input
              v-model="role"
              type="radio"
              :value="option.value"
              class="sr-only"
              @change="error = ''"
            />
            {{ option.label }}
          </label>
        </fieldset>

        <label class="grid gap-1.5 text-sm font-medium">
          Email
          <input
            v-model="email"
            type="email"
            required
            autocomplete="username"
            class="rounded-md border border-rule px-3 py-2.5 text-base focus:border-ledger"
          />
        </label>

        <label class="grid gap-1.5 text-sm font-medium">
          Password
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="rounded-md border border-rule px-3 py-2.5 text-base focus:border-ledger"
          />
        </label>

        <p v-if="error" class="text-sm text-debit" role="alert">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="rounded-md bg-ledger px-4 py-3 font-semibold text-white hover:bg-ledger-dark disabled:cursor-wait disabled:opacity-60"
        >
          {{ loading ? 'Signing in…' : `Sign in as ${role}` }}
        </button>
      </form>

      <p class="mt-5 text-center text-sm text-muted">
        Recording attendance?
        <RouterLink to="/attendance" class="font-semibold text-ledger hover:underline">
          Open the attendance portal
        </RouterLink>
      </p>
    </div>
  </main>
</template>

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
  <main class="page">
    <form class="card" @submit.prevent="submit">
      <h1>Payroll System</h1>
      <p class="subtitle">Sign in to your account</p>

      <fieldset class="roles">
        <legend class="sr-only">Sign in as</legend>
        <label :class="{ active: role === 'employee' }">
          <input v-model="role" type="radio" value="employee" @change="error = ''" />
          Employee
        </label>
        <label :class="{ active: role === 'admin' }">
          <input v-model="role" type="radio" value="admin" @change="error = ''" />
          Admin
        </label>
      </fieldset>

      <label class="field">
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>

      <label class="field">
        Password
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : `Sign in as ${role === 'admin' ? 'Admin' : 'Employee'}` }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #f1f5f9;
}
.card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.08);
  display: grid;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #0f172a;
}
.subtitle {
  margin: -12px 0 0;
  color: #64748b;
}
.roles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin: 0;
  border: 0;
  border-radius: 8px;
  background: #e2e8f0;
}
.roles label {
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  color: #475569;
  font-weight: 500;
}
.roles label.active {
  background: #fff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.1);
}
.roles label:has(input:focus-visible) {
  outline: 2px solid #2563eb;
}
.roles input {
  position: absolute;
  opacity: 0;
}
.field {
  display: grid;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}
.field input {
  padding: 10px 12px;
  font-size: 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}
.field input:focus {
  outline: 2px solid #2563eb;
  border-color: transparent;
}
.error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.875rem;
}
button {
  padding: 12px;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
button:hover {
  background: #1d4ed8;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>

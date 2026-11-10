<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<!-- Placeholder landing page after login; build the real admin/employee screens here. -->
<template>
  <main style="padding: 24px">
    <h1>Welcome, {{ auth.user?.name }}</h1>
    <p>Signed in as {{ auth.user?.role }} ({{ auth.user?.id }})</p>
    <button @click="logout">Log out</button>
  </main>
</template>

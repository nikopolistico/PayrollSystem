import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Role = 'admin' | 'employee'

export interface User {
  id: string
  name: string
  role: Role
}

// Talks to server/index.js; the session is an httpOnly cookie the browser sends automatically.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loaded = ref(false)

  async function loadUser() {
    try {
      const res = await fetch('/api/me')
      user.value = res.ok ? await res.json() : null
    } catch {
      user.value = null
    }
    loaded.value = true
  }

  // Returns an error message, or null on success.
  async function login(role: Role, email: string, password: string) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return body?.error ?? 'Login failed. Please try again.'
      user.value = body
      return null
    } catch {
      return 'Cannot reach the server. Please try again.'
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {})
    user.value = null
  }

  return { user, loaded, loadUser, login, logout }
})

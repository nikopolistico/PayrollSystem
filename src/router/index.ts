import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView },
    { path: '/admin', component: DashboardView, meta: { role: 'admin' } },
    { path: '/employee', component: DashboardView, meta: { role: 'employee' } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) await auth.loadUser()
  if (to.meta.role && auth.user?.role !== to.meta.role) return '/login'
  if (to.path === '/login' && auth.user) return `/${auth.user.role}`
})

export default router

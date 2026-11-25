<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

// 24×24 stroke icons
const icon = {
  overview: 'M4 6h16M4 12h16M4 18h10',
  employees:
    'M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 20v-1a4 4 0 0 0-3-3.87M15 5.13a3 3 0 0 1 0 5.74',
  periods:
    'M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  payslips: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v5h5M9 13h6M9 17h6',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  attendance: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  departments:
    'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
}

// Sidebar groups (the label says what the links are about); phones show them as one tab bar.
const groups = computed(() =>
  auth.user?.role === 'admin'
    ? [
        {
          label: '',
          items: [{ to: '/admin', label: 'Overview', short: 'Overview', icon: icon.overview }],
        },
        {
          label: 'People',
          items: [
            {
              to: '/admin/employees',
              label: 'Employees',
              short: 'Employees',
              icon: icon.employees,
            },
            {
              to: '/admin/departments',
              label: 'Departments',
              short: 'Depts',
              icon: icon.departments,
            },
            {
              to: '/admin/attendance',
              label: 'Attendance',
              short: 'Attendance',
              icon: icon.attendance,
            },
          ],
        },
        {
          label: 'Payroll',
          items: [
            {
              to: '/admin/periods',
              label: 'Payroll periods',
              short: 'Periods',
              icon: icon.periods,
            },
            { to: '/admin/payslips', label: 'Payslips', short: 'Payslips', icon: icon.payslips },
          ],
        },
      ]
    : [
        {
          label: '',
          items: [
            { to: '/employee', label: 'My payslips', short: 'Payslips', icon: icon.payslips },
            { to: '/employee/profile', label: 'My profile', short: 'Profile', icon: icon.profile },
          ],
        },
      ],
)
const nav = computed(() => groups.value.flatMap((g) => g.items))

// Exact match, or a sub-page (Employees stays highlighted on /admin/employees/new).
const isActive = (to: string) =>
  route.path === to || (to !== `/${auth.user?.role}` && route.path.startsWith(`${to}/`))

// Sign out asks first, so a stray tap doesn't end the session.
const signOutBox = ref<InstanceType<typeof ConfirmDialog>>()
const signingOut = ref(false)
async function logout() {
  signingOut.value = true
  await auth.logout()
  signingOut.value = false
  signOutBox.value?.close()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr] print:block">
    <!-- Desktop sidebar; the double rule is a ledger page's margin line -->
    <aside
      class="hidden border-r-4 border-double border-rule px-4 py-6 print:hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col"
    >
      <div class="flex items-center gap-3 px-2">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-ledger text-xl font-bold text-white"
          aria-hidden="true"
        >
          ₱
        </span>
        <div class="leading-tight">
          <p class="font-bold tracking-tight">Payroll System</p>
          <p class="text-sm text-muted">
            {{ auth.user?.role === 'admin' ? 'Admin portal' : 'Employee portal' }}
          </p>
        </div>
      </div>

      <nav aria-label="Main" class="mt-8 grid gap-5 overflow-y-auto">
        <div v-for="g in groups" :key="g.label" class="grid gap-0.5">
          <p v-if="g.label" class="mb-1 px-3 text-xs font-semibold text-muted">{{ g.label }}</p>
          <RouterLink
            v-for="item in g.items"
            :key="item.to"
            :to="item.to"
            :data-active="isActive(item.to) || undefined"
            class="flex items-center gap-3 rounded-md px-3 py-2 font-medium text-muted transition-colors hover:bg-sheet hover:text-ink data-active:bg-sheet data-active:text-ledger data-active:shadow-[inset_3px_0_0_var(--color-ledger)]"
          >
            <svg
              class="size-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="item.icon" />
            </svg>
            {{ item.label }}
          </RouterLink>
        </div>
      </nav>

      <div class="mt-auto border-t border-rule px-2 pt-4 leading-tight">
        <p class="truncate font-semibold" :title="auth.user?.name">{{ auth.user?.name }}</p>
        <p v-if="auth.user?.id !== auth.user?.name" class="text-sm text-muted">
          {{ auth.user?.id }}
        </p>
        <button
          type="button"
          class="btn-ghost -ml-3 mt-2 px-3 py-1.5 text-sm"
          @click="signOutBox?.open()"
        >
          Sign out
        </button>
      </div>
    </aside>

    <!-- Mobile top bar -->
    <header
      class="flex items-center justify-between border-b-4 border-double border-rule px-4 py-3 print:hidden md:hidden"
    >
      <p class="flex items-center gap-2 font-bold tracking-tight">
        <span
          class="grid size-8 place-items-center rounded-md bg-ledger text-white"
          aria-hidden="true"
          >₱</span
        >
        Payroll System
      </p>
      <button type="button" class="btn-ghost px-3 py-1.5 text-sm" @click="signOutBox?.open()">
        Sign out
      </button>
    </header>

    <main class="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-10 md:py-10">
      <!-- Page header: pages put their main buttons here with <Teleport defer to="#page-actions"> -->
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 print:hidden">
        <div>
          <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{{ route.meta.title }}</h1>
          <p v-if="route.meta.description" class="mt-1 max-w-prose text-muted">
            {{ route.meta.description }}
          </p>
        </div>
        <div id="page-actions" class="flex flex-wrap gap-3 empty:hidden"></div>
      </div>
      <div class="mt-8">
        <RouterView />
      </div>
    </main>

    <!-- Mobile bottom tabs -->
    <nav
      aria-label="Main"
      class="fixed inset-x-0 bottom-0 grid border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
      :style="{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }"
    >
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :data-active="isActive(item.to) || undefined"
        class="flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted data-active:text-ledger"
      >
        <svg
          class="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="item.icon" />
        </svg>
        {{ item.short }}
      </RouterLink>
    </nav>

    <ConfirmDialog
      ref="signOutBox"
      title="Sign out?"
      confirm-label="Sign out"
      busy-label="Signing out…"
      tone="primary"
      :busy="signingOut"
      @confirm="logout"
    >
      <p class="text-sm text-muted">You'll need your email and password to sign back in.</p>
    </ConfirmDialog>
  </div>
</template>

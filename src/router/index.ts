import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type Role } from '@/stores/auth'
import PortalLayout from '@/components/PortalLayout.vue'
import LoginView from '@/views/LoginView.vue'
import OverviewView from '@/views/admin/OverviewView.vue'
import EmployeesView from '@/views/admin/EmployeesView.vue'
import EmployeeFormView from '@/views/admin/EmployeeFormView.vue'
import DepartmentsView from '@/views/admin/DepartmentsView.vue'
import PeriodsView from '@/views/admin/PeriodsView.vue'
import PayslipsView from '@/views/admin/PayslipsView.vue'
import MyPayslipsView from '@/views/employee/MyPayslipsView.vue'
import ProfileView from '@/views/employee/ProfileView.vue'
import EmployeeQrView from '@/views/admin/EmployeeQrView.vue'
import AttendanceView from '@/views/admin/AttendanceView.vue'
import PayslipPrintView from '@/views/admin/PayslipPrintView.vue'
import PayslipsPrintAllView from '@/views/admin/PayslipsPrintAllView.vue'
import ScannerView from '@/views/ScannerView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    roles?: Role[] // who may open the page
    title?: string
    description?: string // one line under the page title
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginView, meta: { title: 'Sign in' } },
    {
      path: '/admin',
      component: PortalLayout,
      meta: { roles: ['admin'] },
      children: [
        {
          path: '',
          component: OverviewView,
          meta: { title: 'Overview', description: 'Payroll and people at a glance.' },
        },
        {
          path: 'employees',
          component: EmployeesView,
          meta: {
            title: 'Employees',
            description: 'Everyone on the payroll. Edit details or print their QR code.',
          },
        },
        {
          path: 'employees/new',
          component: EmployeeFormView,
          meta: {
            title: 'Register employee',
            description: 'Their QR code is ready to print right after.',
          },
        },
        {
          path: 'employees/:id/edit',
          component: EmployeeFormView,
          meta: { title: 'Edit employee' },
        },
        { path: 'employees/:id/qr', component: EmployeeQrView, meta: { title: 'QR code' } },
        {
          path: 'departments',
          component: DepartmentsView,
          meta: {
            title: 'Departments',
            description: 'Each department and the hours its employees may time in and out.',
          },
        },
        {
          path: 'attendance',
          component: AttendanceView,
          meta: {
            title: 'Attendance',
            description:
              'Who timed in and out each day, by department. Fix a missing time out here.',
          },
        },
        {
          path: 'periods',
          component: PeriodsView,
          meta: {
            title: 'Payroll periods',
            description: 'Weekly pay from QR attendance, and the daily wage it uses.',
          },
        },
        {
          path: 'payslips',
          component: PayslipsView,
          meta: {
            title: 'Payslips',
            description: 'Open a payslip to add earnings or deductions, or to print it.',
          },
        },
      ],
    },
    {
      path: '/employee',
      component: PortalLayout,
      meta: { roles: ['employee'] },
      children: [
        {
          path: '',
          component: MyPayslipsView,
          meta: { title: 'My payslips', description: 'Your pay for each week, line by line.' },
        },
        {
          path: 'profile',
          component: ProfileView,
          meta: {
            title: 'My profile',
            description: 'Your work details and government IDs on file.',
          },
        },
      ],
    },
    // Printable payslip: full page without the admin menu, so it prints clean
    {
      path: '/admin/payslips/:id/print',
      component: PayslipPrintView,
      meta: { roles: ['admin'], title: 'Print payslip' },
    },
    {
      path: '/admin/payslips/print-all',
      component: PayslipsPrintAllView,
      meta: { roles: ['admin'], title: 'Print payslips' },
    },
    // Attendance portal: public kiosk page, opened from the login page
    { path: '/attendance', component: ScannerView, meta: { title: 'Attendance portal' } },
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) await auth.loadUser()
  if (to.meta.roles && !(auth.user && to.meta.roles.includes(auth.user.role))) return '/login'
  if (to.path === '/login' && auth.user) return `/${auth.user.role}`
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Payroll System` : 'Payroll System'
})

export default router

import type { ScanLog } from './api'

export interface Visit {
  key: string
  employee_no: string
  name: string
  department_name: string
  time_in?: string
  time_out?: string
  in_id?: number // log ids, for deleting the visit
  out_id?: number
  last: string // latest scan in this visit, for sorting
}

// Pairs each 'in' scan with that employee's next 'out' scan: one row per visit, newest activity first.
export function pairScans(logs: ScanLog[]): Visit[] {
  const open = new Map<string, Visit>() // employee_no -> visit still waiting for its 'out'
  const visits: Visit[] = []
  const oldestFirst = [...logs].sort((a, b) => a.scanned_at.localeCompare(b.scanned_at))
  for (const l of oldestFirst) {
    let visit = l.log_type === 'out' ? open.get(l.employee_no) : undefined
    if (!visit) {
      const { employee_no, name, department_name } = l
      visit = { key: String(l.id), employee_no, name, department_name, last: l.scanned_at }
      visits.push(visit)
    }
    visit.last = l.scanned_at
    if (l.log_type === 'in') {
      visit.time_in = l.scanned_at
      visit.in_id = l.id
      open.set(l.employee_no, visit)
    } else {
      visit.time_out = l.scanned_at
      visit.out_id = l.id
      open.delete(l.employee_no)
    }
  }
  return visits.sort((a, b) => b.last.localeCompare(a.last))
}

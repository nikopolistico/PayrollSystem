import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pairScans } from '../attendance.ts'

const log = (id: number, no: string, type: 'in' | 'out', hhmm: string) => ({
  id, employee_no: no, name: no, department_name: 'D', log_type: type,
  scanned_at: `2026-11-25T${hhmm}:00.000Z`,
})

test('pairs in/out per employee, newest activity first', () => {
  const visits = pairScans([
    log(4, 'B', 'in', '09:00'),
    log(3, 'A', 'out', '17:00'),
    log(2, 'B', 'out', '08:30'), // out with no earlier in: own row
    log(1, 'A', 'in', '08:00'),
  ])
  assert.deepEqual(
    visits.map((v) => [v.employee_no, v.time_in?.slice(11, 16), v.time_out?.slice(11, 16)]),
    [
      ['A', '08:00', '17:00'],
      ['B', '09:00', undefined],
      ['B', undefined, '08:30'],
    ],
  )
})

test('second in/out pair on the same day is its own row', () => {
  const visits = pairScans([log(1, 'A', 'in', '08:00'), log(2, 'A', 'out', '12:00'), log(3, 'A', 'in', '13:00')])
  assert.equal(visits.length, 2)
  assert.equal(visits[0]!.time_in?.slice(11, 16), '13:00')
  assert.equal(visits[0]!.time_out, undefined)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acronym } from '../acronym.ts'

test('department code from name', () => {
  assert.equal(acronym('Test Operations'), 'TO')
  assert.equal(acronym('Sales and Marketing'), 'SM')
  assert.equal(acronym('Operations'), 'OPE')
  assert.equal(acronym('HR'), 'HR')
  assert.equal(acronym('  research & development  '), 'RD')
  assert.equal(acronym('Department of the Interior'), 'DI')
  assert.equal(acronym('And'), 'AND') // only small words: still gives a code
  assert.equal(acronym(''), '')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ampm, inWindow } from './time.js'

test('inWindow: same-day window, ends inclusive', () => {
  assert.equal(inWindow('06:00', '06:00', '09:00'), true)
  assert.equal(inWindow('09:00', '06:00', '09:00'), true)
  assert.equal(inWindow('09:01', '06:00', '09:00'), false)
  assert.equal(inWindow('05:59', '06:00', '09:00'), false)
})

test('inWindow: window crossing midnight', () => {
  assert.equal(inWindow('23:30', '22:00', '02:00'), true)
  assert.equal(inWindow('01:15', '22:00', '02:00'), true)
  assert.equal(inWindow('12:00', '22:00', '02:00'), false)
})

test('ampm', () => {
  assert.equal(ampm('00:05'), '12:05 AM')
  assert.equal(ampm('06:00'), '6:00 AM')
  assert.equal(ampm('12:30'), '12:30 PM')
  assert.equal(ampm('17:45'), '5:45 PM')
})

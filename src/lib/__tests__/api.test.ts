import { test } from 'node:test'
import assert from 'node:assert/strict'
import { useApi, pending } from '../api.ts'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('useApi loads once, not in a loop', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify([{ id: 1 }]), { status: 200 })
  }
  const { data, reload } = useApi<{ id: number }[]>('/api/x')
  await wait(300)
  assert.equal(calls, 1) // was endless before: each request re-triggered the next
  assert.deepEqual(data.value, [{ id: 1 }])
  assert.equal(pending.value, 0)

  reload()
  await wait(50)
  assert.equal(calls, 2)
})

test('a null URL never loads', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response('[]')
  }
  useApi(null)
  await wait(300)
  assert.equal(calls, 0)
})

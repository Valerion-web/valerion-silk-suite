import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const serverPath = new URL('../server.js', import.meta.url)

test('mounts the generic API-key webhook before store and CSRF middleware', async () => {
  const source = await readFile(serverPath, 'utf8')
  const bodyParser = source.indexOf('app.use(express.json())')
  const webhook = source.indexOf("app.use('/api/integrations/courier-events', courierEventsRoutes)")
  const storeResolution = source.indexOf("app.use('/api', resolveStore)")
  const csrf = source.indexOf("app.use('/api', csrfMiddleware)")

  assert.ok(bodyParser >= 0)
  assert.ok(webhook > bodyParser)
  assert.ok(storeResolution > webhook)
  assert.ok(csrf > webhook)
  assert.doesNotMatch(source.slice(webhook, webhook + 80), /shiprocket|kartrocket|\bsr\b|\bkr\b/i)
})

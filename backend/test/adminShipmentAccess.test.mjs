import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createAdminShipmentOperationsHandler } from '../services/adminShipmentManagement.js'

const routesPath = new URL('../routes/adminRoutes.js', import.meta.url)

test('shipment administration endpoints remain behind admin, orders, and concrete-store authorization', async () => {
  const source = await readFile(routesPath, 'utf8')
  assert.match(source, /router\.use\(protect,\s*requireAdmin\)/)
  assert.match(source, /router\.get\('\/shipments\/:id\/operations',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.post\('\/shipments\/:id\/awb',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.post\('\/shipments\/:id\/label',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.post\('\/shipments\/:id\/pickup',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.post\('\/manifests',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.get\('\/manifests\/:id\/operations',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
  assert.match(source, /router\.post\('\/manifests\/:id\/print',\s*requireCapability\('orders'\),\s*requireConcreteStore,/)
})

test('admin shipment visibility is limited to the selected store and returns event and operation history', async () => {
  let where
  let operationReads = 0
  const handler = createAdminShipmentOperationsHandler({
    prismaClient: {
      shipment: {
        findFirst: async (args) => {
          where = args.where
          return args.where.order.storeId === 8 ? { id: args.where.id } : null
        },
      },
    },
    storeScope: (req) => ({ storeId: req.store.id }),
    shipmentOperations: {
      getShipmentOperations: async (id) => {
        operationReads += 1
        return {
          id,
          shiprocketOrderId: 'provider-order',
          trackingEvents: [{ id: 4, status: 'In Transit', occurredAt: new Date('2026-11-08T10:00:00Z') }],
          operations: [{ id: 7, operationType: 'REQUEST_PICKUP', status: 'SUCCEEDED' }],
        }
      },
    },
  })
  const invoke = async (storeId) => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      },
    }
    await handler({ params: { id: '12' }, store: { id: storeId } }, response, (error) => { throw error })
    return response
  }

  const otherStore = await invoke(9)
  assert.equal(otherStore.statusCode, 404)
  assert.equal(operationReads, 0)

  const authorizedStore = await invoke(8)
  assert.deepEqual(where, { id: 12, order: { storeId: 8 } })
  assert.equal(authorizedStore.statusCode, 200)
  assert.equal(authorizedStore.body.shipment.trackingEvents[0].status, 'In Transit')
  assert.equal(authorizedStore.body.shipment.operations[0].status, 'SUCCEEDED')
  assert.equal(operationReads, 1)
})

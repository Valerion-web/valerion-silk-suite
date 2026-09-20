import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createAdminMaintenanceForTests } from '../maintenance/adminBootstrap.js'
import { ADMIN_ROLES } from '../middleware/adminContext.js'

const config = {
  ADMIN_EMAIL: 'configured-admin@example.test',
  ADMIN_PASSWORD: 'configured-value',
  ADMIN_NAME: 'Configured Admin',
}

const matchingHash = 'bcrypt-hash-value'

const makeFakePrisma = ({ existingAdmin = null, assignment = null, staleAdmins = [], store = { id: 2, slug: 'haston' }, storeLookupError = null } = {}) => {
  const calls = []
  let findUniqueCalls = 0
  const fakePrisma = {
    store: {
      findFirst: async () => {
        calls.push(['store.findFirst'])
        if (storeLookupError) throw storeLookupError
        return store
      },
    },
    user: {
      findUnique: async () => {
        calls.push(['user.findUnique'])
        findUniqueCalls += 1
        return existingAdmin
      },
      findMany: async () => {
        calls.push(['user.findMany'])
        return staleAdmins
      },
      create: async (args) => {
        calls.push(['user.create', args])
        return { id: 101, ...args.data }
      },
      update: async (args) => {
        calls.push(['user.update', args])
        return args.data
      },
    },
    adminAssignment: {
      findFirst: async () => {
        calls.push(['adminAssignment.findFirst'])
        return assignment
      },
      create: async (args) => {
        calls.push(['adminAssignment.create', args])
        return args.data
      },
      update: async (args) => {
        calls.push(['adminAssignment.update', args])
        return args.data
      },
    },
  }
  return { fakePrisma, calls, get findUniqueCalls() { return findUniqueCalls } }
}

const fakeBcrypt = {
  compare: async (candidate, hash) => candidate === config.ADMIN_PASSWORD && hash === matchingHash,
  hash: async () => matchingHash,
}

const makeMaintenance = (prisma, env = config, bcrypt = fakeBcrypt) => createAdminMaintenanceForTests({
  prismaClient: prisma,
  bcryptClient: bcrypt,
  env,
  defaultStoreSlug: 'haston',
})

test('audit reports CREATE without writing or exposing credentials', async () => {
  const { fakePrisma, calls } = makeFakePrisma()
  const report = await makeMaintenance(fakePrisma).auditAdminBootstrap()
  const action = report.actions[0]

  assert.equal(action.action, 'CREATE')
  assert.equal(action.email, config.ADMIN_EMAIL)
  assert.equal(action.expectedStore, 'haston')
  assert.equal(action.passwordResetRequested, false)
  assert.deepEqual(report.deleteOrDeactivate, [])
  assert.equal(report.message, 'AUDIT ONLY — NO DATABASE CHANGES WERE MADE')
  assert.equal(calls.some(([name]) => name.endsWith('.create') || name.endsWith('.update')), false)
  assert.equal(JSON.stringify(report).includes(config.ADMIN_PASSWORD), false)
  assert.equal(JSON.stringify(report).includes(matchingHash), false)
  assert.equal(JSON.stringify(report).includes('JWT_SECRET'), false)
  assert.equal(JSON.stringify(report).includes('DATABASE_URL'), false)
})

test('audit reports role, assignment, and password differences without writes', async () => {
  const existingAdmin = { id: 7, email: config.ADMIN_EMAIL, password: 'different-hash', role: 'CUSTOMER', storeId: 1, store: { slug: 'house-of-valerion' } }
  const assignment = { id: 12, storeId: 1, isActive: false }
  const staleAdmin = { id: 8, email: 'other-admin@example.test', password: 'different-hash', role: 'ADMIN', store: { slug: 'haston' } }
  const { fakePrisma, calls } = makeFakePrisma({ existingAdmin, assignment, staleAdmins: [staleAdmin] })
  const report = await makeMaintenance(fakePrisma).auditAdminBootstrap()

  assert.deepEqual(report.actions.map((item) => item.action), ['UPDATE', 'UPDATE'])
  assert.equal(report.actions[0].roleDiffers, true)
  assert.equal(report.actions[0].assignmentDiffers, true)
  assert.equal(report.actions[0].passwordResetRequested, true)
  assert.equal(report.actions[1].passwordResetRequested, true)
  assert.equal(calls.some(([name]) => name.endsWith('.create') || name.endsWith('.update')), false)
})

test('audit reports NO CHANGE for matching admin and assignment', async () => {
  const existingAdmin = { id: 7, email: config.ADMIN_EMAIL, password: matchingHash, role: 'ADMIN', storeId: 2, store: { slug: 'haston' } }
  const assignment = { id: 12, storeId: 2, isActive: true }
  const { fakePrisma } = makeFakePrisma({ existingAdmin, assignment })
  const report = await makeMaintenance(fakePrisma).auditAdminBootstrap()

  assert.equal(report.actions.length, 1)
  assert.equal(report.actions[0].action, 'NO CHANGE')
  assert.equal(report.actions[0].passwordResetRequested, false)
  assert.equal(report.actions[0].assignmentDiffers, false)
})

test('bootstrap creates an admin with bcrypt output and assignment using mocked Prisma', async () => {
  const { fakePrisma, calls } = makeFakePrisma()
  const result = await makeMaintenance(fakePrisma).runAdminBootstrap()

  assert.equal(result.created, true)
  const create = calls.find(([name]) => name === 'user.create')
  const assignment = calls.find(([name]) => name === 'adminAssignment.create')
  assert.equal(create[1].data.password, matchingHash)
  assert.equal(create[1].data.role, 'ADMIN')
  assert.equal(create[1].data.storeId, 2)
  assert.equal(assignment[1].data.storeId, 2)
  assert.equal(calls.some(([name]) => ['product.create', 'order.create', 'stockHistory.create'].includes(name)), false)
})

test('bootstrap updates only admin records using mocked Prisma', async () => {
  const existingAdmin = { id: 7, email: config.ADMIN_EMAIL, password: 'different-hash', role: 'CUSTOMER', storeId: 1 }
  const assignment = { id: 12, storeId: 1, isActive: false }
  const { fakePrisma, calls } = makeFakePrisma({ existingAdmin, assignment })
  const result = await makeMaintenance(fakePrisma).runAdminBootstrap()

  assert.equal(result.updated, true)
  assert.equal(calls.filter(([name]) => name === 'user.update').length, 1)
  assert.equal(calls.filter(([name]) => name === 'adminAssignment.update').length, 1)
  assert.equal(calls.some(([name]) => name.includes('product') || name.includes('order') || name.includes('stock')), false)
})

test('maintenance fails clearly for missing configuration without database access', async () => {
  const { fakePrisma, calls } = makeFakePrisma()
  await assert.rejects(() => makeMaintenance(fakePrisma, {}).auditAdminBootstrap(), /ADMIN_PASSWORD must be configured/)
  assert.equal(calls.length, 0)
})

test('maintenance rejects invalid admin configuration without database access', async () => {
  const { fakePrisma, calls } = makeFakePrisma()
  await assert.rejects(() => makeMaintenance(fakePrisma, { ...config, ADMIN_EMAIL: 'invalid-email' }).auditAdminBootstrap(), /ADMIN_EMAIL must be valid/)
  assert.equal(calls.length, 0)
})

test('maintenance propagates database and reconciliation failures without secrets', async () => {
  const databaseError = new Error('database unavailable')
  const databaseFailure = makeFakePrisma({ storeLookupError: databaseError })
  await assert.rejects(() => makeMaintenance(databaseFailure.fakePrisma).auditAdminBootstrap(), /database unavailable/)

  const reconciliationFailure = makeFakePrisma({ existingAdmin: { id: 7, email: config.ADMIN_EMAIL, password: matchingHash, role: 'ADMIN', storeId: 2, store: { slug: 'haston' } } })
  const failingBcrypt = { compare: async () => { throw new Error('comparison failed') }, hash: fakeBcrypt.hash }
  await assert.rejects(() => makeMaintenance(reconciliationFailure.fakePrisma, config, failingBcrypt).auditAdminBootstrap(), /comparison failed/)
})

test('all supported admin roles remain defined', () => {
  assert.deepEqual([...ADMIN_ROLES].sort(), ['ADMIN', 'BRAND_MANAGER', 'INVENTORY_MANAGER', 'MARKETING_MANAGER', 'ORDER_MANAGER', 'SUPER_ADMIN'])
})

test('normal server source contains no startup reconciliation hook', async () => {
  const serverSource = await readFile(new URL('../server.js', import.meta.url), 'utf8')
  assert.equal(serverSource.includes('runAdminBootstrap'), false)
  assert.equal(serverSource.includes('ENABLE_ADMIN_BOOTSTRAP'), false)
})

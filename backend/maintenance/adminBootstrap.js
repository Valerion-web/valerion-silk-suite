import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { DEFAULT_STORE_SLUG } from '../middleware/storeMiddleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const createAdminMaintenance = ({ prismaClient = prisma, bcryptClient = bcrypt, env = process.env, defaultStoreSlug = DEFAULT_STORE_SLUG } = {}) => {
  const getAdminBootstrapConfig = () => {
    const adminEmail = env.ADMIN_EMAIL || 'admin@valerion.test'
    const adminPassword = env.ADMIN_PASSWORD?.trim()
    if (!adminEmail.includes('@')) throw new Error('ADMIN_EMAIL must be valid')
    if (!adminPassword) throw new Error('ADMIN_PASSWORD must be configured for admin maintenance')
    return { adminEmail, adminPassword, adminName: env.ADMIN_NAME || 'Admin' }
  }

  const findAdminStore = async () => {
    const adminStore = await prismaClient.store.findFirst({
      where: { slug: defaultStoreSlug, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
    }) || await prismaClient.store.findFirst({
      where: { status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      orderBy: { id: 'asc' },
    })
    if (!adminStore) throw new Error('No active store is available for admin maintenance')
    return adminStore
  }

  const auditAdminBootstrap = async () => {
    const { adminEmail, adminPassword } = getAdminBootstrapConfig()
    const adminStore = await findAdminStore()
    const existingAdmin = await prismaClient.user.findUnique({
      where: { email: adminEmail },
      include: { store: { select: { slug: true } } },
    })
    const adminAssignment = existingAdmin
      ? await prismaClient.adminAssignment.findFirst({ where: { userId: existingAdmin.id, role: 'ADMIN' } })
      : null
    const actions = []

    if (!existingAdmin) {
      actions.push({
        action: 'CREATE',
        accountExists: false,
        email: adminEmail,
        currentRole: null,
        expectedRole: 'ADMIN',
        currentStore: null,
        expectedStore: adminStore.slug,
        roleDiffers: true,
        assignmentDiffers: true,
        assignmentExists: false,
        assignmentActive: false,
        passwordResetRequested: false,
      })
    } else {
      const passwordResetRequested = !existingAdmin.password || existingAdmin.password.trim() === '' || !(await bcryptClient.compare(adminPassword, existingAdmin.password))
      const roleDiffers = existingAdmin.role !== 'ADMIN'
      const assignmentDiffers = !adminAssignment || adminAssignment.storeId !== adminStore.id || !adminAssignment.isActive
      actions.push({
        action: roleDiffers || assignmentDiffers || passwordResetRequested ? 'UPDATE' : 'NO CHANGE',
        accountExists: true,
        email: existingAdmin.email,
        currentRole: existingAdmin.role,
        expectedRole: 'ADMIN',
        currentStore: existingAdmin.store?.slug || null,
        expectedStore: adminStore.slug,
        roleDiffers,
        assignmentDiffers,
        assignmentExists: Boolean(adminAssignment),
        assignmentActive: Boolean(adminAssignment?.isActive),
        passwordResetRequested,
      })
    }

    const staleAdmins = await prismaClient.user.findMany({
      where: { role: 'ADMIN', ...(existingAdmin ? { id: { not: existingAdmin.id } } : {}) },
      include: { store: { select: { slug: true } } },
    })
    for (const admin of staleAdmins) {
      const passwordResetRequested = !admin.password || admin.password.trim() === '' || !(await bcryptClient.compare(adminPassword, admin.password))
      actions.push({
        action: passwordResetRequested ? 'UPDATE' : 'NO CHANGE',
        accountExists: true,
        email: admin.email,
        currentRole: admin.role,
        expectedRole: admin.role,
        currentStore: admin.store?.slug || null,
        expectedStore: admin.store?.slug || null,
        roleDiffers: false,
        assignmentDiffers: false,
        passwordResetRequested,
      })
    }

    return {
      auditOnly: true,
      message: 'AUDIT ONLY — NO DATABASE CHANGES WERE MADE',
      targetStore: adminStore.slug,
      actions,
      deleteOrDeactivate: [],
    }
  }

  const runAdminBootstrap = async ({ dryRun = false } = {}) => {
    const { adminEmail, adminPassword, adminName } = getAdminBootstrapConfig()
    const adminStore = await findAdminStore()
    const existingAdmin = await prismaClient.user.findUnique({ where: { email: adminEmail } })
    if (!existingAdmin) {
      if (dryRun) return { created: true, updated: false, repairedPasswords: 0, email: adminEmail, store: adminStore.slug, dryRun: true }
      const hashedPassword = await bcryptClient.hash(adminPassword, 10)
      const createdAdmin = await prismaClient.user.create({
        data: { name: adminName, email: adminEmail, password: hashedPassword, role: 'ADMIN', storeId: adminStore.id },
      })
      await prismaClient.adminAssignment.create({ data: { userId: createdAdmin.id, role: 'ADMIN', storeId: adminStore.id, isActive: true } })
      return { created: true, updated: false, repairedPasswords: 0, email: adminEmail, store: adminStore.slug }
    }

    const updates = {}
    if (existingAdmin.role !== 'ADMIN') updates.role = 'ADMIN'
    let repairedPasswords = 0
    const passwordNeedsReset = !existingAdmin.password || existingAdmin.password.trim() === '' || !(await bcryptClient.compare(adminPassword, existingAdmin.password))
    if (passwordNeedsReset) {
      updates.password = await bcryptClient.hash(adminPassword, 10)
      repairedPasswords += 1
    }
    if (existingAdmin.storeId !== adminStore.id) updates.storeId = adminStore.id
    if (Object.keys(updates).length > 0) await prismaClient.user.update({ where: { email: adminEmail }, data: updates })

    const adminAssignment = await prismaClient.adminAssignment.findFirst({ where: { userId: existingAdmin.id, role: 'ADMIN' } })
    if (adminAssignment) {
      if (adminAssignment.storeId !== adminStore.id || !adminAssignment.isActive) {
        await prismaClient.adminAssignment.update({ where: { id: adminAssignment.id }, data: { storeId: adminStore.id, isActive: true } })
      }
    } else {
      await prismaClient.adminAssignment.create({ data: { userId: existingAdmin.id, role: 'ADMIN', storeId: adminStore.id, isActive: true } })
    }

    const staleAdmins = await prismaClient.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of staleAdmins) {
      const adminPasswordNeedsReset = !admin.password || admin.password.trim() === '' || !(await bcryptClient.compare(adminPassword, admin.password))
      if (adminPasswordNeedsReset) {
        await prismaClient.user.update({ where: { id: admin.id }, data: { password: await bcryptClient.hash(adminPassword, 10) } })
        repairedPasswords += 1
      }
    }

    return {
      created: false,
      updated: Object.keys(updates).length > 0 || passwordNeedsReset || !adminAssignment || (Boolean(adminAssignment) && (adminAssignment.storeId !== adminStore.id || !adminAssignment.isActive)),
      repairedPasswords,
      email: adminEmail,
      store: adminStore.slug,
      dryRun,
    }
  }

  return { auditAdminBootstrap, runAdminBootstrap }
}

export const createAdminMaintenanceForTests = createAdminMaintenance

const defaultMaintenance = createAdminMaintenance()
export const auditAdminBootstrap = (...args) => defaultMaintenance.auditAdminBootstrap(...args)
export const runAdminBootstrap = (...args) => defaultMaintenance.runAdminBootstrap(...args)
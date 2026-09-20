import prisma from '../lib/prisma.js'
import { auditAdminBootstrap } from '../maintenance/adminBootstrap.js'

try {
  await prisma.$connect()
  const report = await auditAdminBootstrap()
  console.log(report.message)
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(`[Admin audit] Failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
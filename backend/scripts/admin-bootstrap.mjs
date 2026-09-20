import prisma from '../lib/prisma.js'
import { runAdminBootstrap } from '../maintenance/adminBootstrap.js'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: npm run admin:bootstrap [-- --dry-run]')
  console.log('Runs the explicit admin bootstrap/reconciliation maintenance task.')
  console.log('Use --dry-run to inspect planned changes without writing to PostgreSQL.')
  process.exit(0)
}

try {
  await prisma.$connect()
  const dryRun = process.argv.includes('--dry-run')
  const result = await runAdminBootstrap({ dryRun })
  console.log(`[Admin maintenance] ${dryRun ? 'Dry run completed' : 'Completed'} for ${result.email} in store ${result.store}`)
  console.log(`[Admin maintenance] Account created: ${result.created ? 'yes' : 'no'}; account metadata updated: ${result.updated ? 'yes' : 'no'}; password repairs: ${result.repairedPasswords}`)
} catch (error) {
  console.error(`[Admin maintenance] Failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
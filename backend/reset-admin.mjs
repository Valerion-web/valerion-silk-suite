import 'dotenv/config'
import prisma from './lib/prisma.js'
import bcrypt from 'bcryptjs'

async function resetAdminPassword() {
  try {
    console.log('\n=== RESET ADMIN PASSWORD ===\n')

    const newPassword = 'Admin@123456'
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    console.log('Updating admin password...')
    const updatedUser = await prisma.user.update({
      where: { email: 'admin@valerion.test' },
      data: { password: hashedPassword },
    })

    console.log('✓ Admin password reset successfully')
    console.log(`\nCredentials for testing:`)
    console.log(`Email: ${updatedUser.email}`)
    console.log(`Password: ${newPassword}`)
    console.log(`\nYou can now login with these credentials.`)
    console.log()
  } catch (error) {
    console.error('\n=== ERROR ===')
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword()

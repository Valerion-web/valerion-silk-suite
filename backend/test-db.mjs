import 'dotenv/config'
import prisma from './lib/prisma.js'

async function testDatabase() {
  try {
    console.log('\n=== DATABASE CONNECTION TEST ===\n')

    // Test 1: Connect to database
    console.log('1. Testing database connection...')
    const userCount = await prisma.user.count()
    console.log('   ✓ Connection successful')
    console.log(`   ✓ User table exists with ${userCount} users\n`)

    // Test 2: List all users
    console.log('2. Fetching all users...')
    const users = await prisma.user.findMany()
    if (users.length === 0) {
      console.log('   ⚠ No users found in database\n')
    } else {
      console.log(`   ✓ Found ${users.length} user(s):`)
      users.forEach((user) => {
        console.log(`     - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`)
      })
      console.log()
    }

    // Test 3: Check for admin user
    console.log('3. Checking for admin user...')
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (adminUser) {
      console.log(`   ✓ Admin user found: ${adminUser.email}\n`)
    } else {
      console.log('   ⚠ No admin user found in database\n')
    }

    console.log('=== ALL TESTS PASSED ===\n')
  } catch (error) {
    console.error('\n=== DATABASE CONNECTION ERROR ===\n')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    console.error('\n=== DEBUGGING INFO ===')
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set')
    console.error('NODE_ENV:', process.env.NODE_ENV)
    console.error()
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()

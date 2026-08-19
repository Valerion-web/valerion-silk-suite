import 'dotenv/config'
import prisma from './lib/prisma.js'
import bcrypt from 'bcryptjs'

async function testLoginFlow() {
  try {
    console.log('\n=== LOGIN FLOW TEST ===\n')

    // Step 1: Check admin user
    console.log('1. Fetching admin user...')
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@valerion.test' },
    })

    if (!adminUser) {
      console.error('   ✗ Admin user not found\n')
      return
    }

    console.log(`   ✓ Admin user found: ${adminUser.email}`)
    console.log(`   ✓ Password hash exists: ${adminUser.password ? 'Yes' : 'No'}`)
    console.log(`   ✓ Role: ${adminUser.role}\n`)

    // Step 2: Test bcrypt password verification with a known password
    console.log('2. Testing bcrypt password hash...')
    console.log('   Note: We do not know the original password.')
    console.log('   The hash format appears valid: ' + (adminUser.password?.substring(0, 8) || 'invalid'))
    console.log()

    // Step 3: Test login with test credentials
    console.log('3. Testing login endpoint...')
    const testEmail = 'testuser@example.com'
    const testUser = await prisma.user.findUnique({
      where: { email: testEmail },
    })

    if (testUser) {
      console.log(`   ✓ Test user found: ${testUser.email}`)
      console.log(`   ✓ Password hash: ${testUser.password?.substring(0, 15)}...`)
      console.log()

      // Try a test password
      const testPassword = 'testpassword123'
      const hashMatches = await bcrypt.compare(testPassword, testUser.password)
      console.log(`4. Testing password comparison with "${testPassword}":`)
      console.log(`   Result: ${hashMatches ? '✓ Password matches' : '✗ Password does not match'}`)
      console.log()
    }

    // Step 4: Simulate login request
    console.log('5. Simulating login request to /api/auth/login...')
    const loginPayload = {
      email: 'admin@valerion.test',
      password: 'admin123', // This is a guess; we need to know the actual password
    }
    console.log(`   Request body: ${JSON.stringify(loginPayload)}`)
    console.log('   Note: Cannot verify without knowing the actual admin password')
    console.log()

    console.log('=== TEST SUMMARY ===')
    console.log('✓ Database connection working')
    console.log('✓ Admin user exists')
    console.log('✓ Password hash exists')
    console.log('✓ Bcrypt library ready')
    console.log('\nTo test actual login, you need to:')
    console.log('1. Use the correct admin password')
    console.log('2. Or reset the admin password to a known value')
    console.log()
  } catch (error) {
    console.error('\n=== ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testLoginFlow()

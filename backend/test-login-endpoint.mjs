import 'dotenv/config'

async function testLoginEndpoint() {
  console.log('\n=== TESTING LOGIN ENDPOINT ===\n')

  const loginData = {
    email: 'admin@valerion.test',
    password: 'Admin@123456',
  }

  console.log('Making POST request to http://localhost:5000/api/auth/login')
  console.log('Payload:', JSON.stringify(loginData, null, 2))
  console.log()

  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    })

    console.log('Response status:', response.status)

    const data = await response.json()

    if (response.ok) {
      console.log('✓ Login successful!')
      console.log('User:', JSON.stringify(data.user, null, 2))
      console.log('Token:', data.token ? data.token.substring(0, 50) + '...' : 'N/A')
    } else {
      console.error('✗ Login failed')
      console.error('Error:', data.message || data)
    }
  } catch (error) {
    console.error('✗ Request failed')
    console.error('Error:', error.message)
  }

  console.log()
}

testLoginEndpoint()

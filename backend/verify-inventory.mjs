const base = 'http://localhost:5000';
const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@valerion.test', password: 'Admin@123456' }),
});
const loginData = await loginRes.json();
const invRes = await fetch(`${base}/api/admin/inventory`, {
  headers: { Authorization: `Bearer ${loginData.token}` },
});
const invData = await invRes.json();
console.log(JSON.stringify({ loginStatus: loginRes.status, inventoryStatus: invRes.status, count: invData.items?.length || 0, sample: invData.items?.[0] || null }, null, 2));

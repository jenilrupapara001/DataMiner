const https = require('http');

async function test() {
  // Login
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'admin@gms.com', password: 'Admin@123'})
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData.success);
  const token = loginData.data?.accessToken;
  if (!token) { console.error('No token', loginData); return; }

  // Sellers
  const sellersRes = await fetch(`http://localhost:3001/api/sellers?limit=2`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const sellersData = await sellersRes.json();
  console.log('Sellers:', sellersData.success ? `${sellersData.data.sellers.length} sellers` : sellersData);

  // Asins
  const asinsRes = await fetch(`http://localhost:3001/api/asins?limit=2`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const asinsData = await asinsRes.json();
  console.log('Asins:', asinsData.success ? `${asinsData.asins.length} asins` : asinsData);

  // Notifications
  const notifRes = await fetch('http://localhost:3001/api/notifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const notifData = await notifRes.json();
  console.log('Notifications:', notifData.success ? `${notifData.data.length} notifications` : notifData);
}

test().catch(console.error);

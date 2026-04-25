const fetch = require('node-fetch');

(async () => {
  const login = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'admin@gms.com', password: 'Admin@123'})
  });
  const loginData = await login.json();
  const token = loginData.data?.accessToken;
  if (!token) { console.error('Login failed:', loginData); return; }

  console.log('Token:', token.slice(0,20)+'...');

  const trackerRes = await fetch('http://localhost:3001/api/seller-tracker', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const trackerData = await trackerRes.json();
  console.log('Seller-Tracker:', trackerData.success, 'count:', trackerData.data?.length, 'errors:', trackerData.message?.substring(0,100));

  const asinsRes = await fetch('http://localhost:3001/api/asins?limit=2', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const asinsData = await asinsRes.json();
  console.log('Asins:', asinsData.success, 'count:', asinsData.asins?.length);

  const notifRes = await fetch('http://localhost:3001/api/notifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const notifData = await notifRes.json();
  console.log('Notifications:', notifData.success, 'count:', notifData.data?.length);

  const actionsRes = await fetch('http://localhost:3001/api/actions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const actionsData = await actionsRes.json();
  console.log('Actions:', actionsData.success, 'count:', actionsData.data?.length);
})();

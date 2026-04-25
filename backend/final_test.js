#!/usr/bin/env node
const http = require('http');

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({status: res.statusCode, data: JSON.parse(data)}));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  // Login
  const login = await request('POST', 'http://localhost:3001/api/auth/login', {
    'Content-Type': 'application/json'
  }, {email: 'admin@gms.com', password: 'Admin@123'});
  console.log('Login:', login.data.success ? 'OK' : 'FAIL', login.data.message);
  const token = login.data.data?.accessToken;
  if (!token) process.exit(1);

  const auth = {'Authorization': `Bearer ${token}`};

  // Sellers GET
  const sellers = await request('GET', 'http://localhost:3001/api/sellers?limit=2', auth);
  console.log('Sellers GET:', sellers.data.success, 'count:', sellers.data.data?.sellers?.length || 0);

  // Sellers POST
  const newSeller = await request('POST', 'http://localhost:3001/api/sellers', auth, {
    name: 'SQL Test Seller', marketplace: 'amazon.in', sellerId: 'SQLTEST123', status: 'Active'
  });
  console.log('Seller CREATE:', newSeller.data.success ? 'OK id='+newSeller.data._id : 'FAIL', newSeller.data.message?.substring(0,50));

  // Asins GET
  const asins = await request('GET', 'http://localhost:3001/api/asins?limit=2', auth);
  console.log('Asins GET:', asins.data.success, 'count:', asins.data.asins?.length || 0, 'total:', asins.data.pagination?.total);

  // Notifications GET
  const notifs = await request('GET', 'http://localhost:3001/api/notifications', auth);
  console.log('Notifications GET:', notifs.data.success, 'count:', notifs.data.data?.length || 0);

  // Actions GET
  const actions = await request('GET', 'http://localhost:3001/api/actions', auth);
  console.log('Actions GET:', actions.data.success, 'count:', actions.data.data?.length || 0);

  // Chat Conversations GET
  const chats = await request('GET', 'http://localhost:3001/api/chat/conversations', auth);
  console.log('Chat GET:', chats.data.success, 'count:', chats.data.data?.length || 0, 'error:', chats.data.message?.substring(0,50));

  // Seller Tracker GET
  const tracker = await request('GET', 'http://localhost:3001/api/seller-tracker', auth);
  console.log('Seller-Tracker GET:', tracker.data.success, 'count:', tracker.data.data?.length || 0, 'err:', tracker.data.message?.substring(0,50));

  // Dashboard GET
  const dash = await request('GET', 'http://localhost:3001/api/data/dashboard', auth);
  console.log('Dashboard GET:', dash.data.success, 'hasData:', !!dash.data.data);
})();

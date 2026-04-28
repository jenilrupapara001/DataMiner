const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/export/downloads',
  method: 'GET',
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('BODY:', data.substring(0, 200)));
});

req.on('error', error => {
  console.error('ERROR:', error.message);
});

req.end();

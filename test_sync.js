const fetch = require('node-fetch'); // we'll use standard http

// we don't have node-fetch, use http standard library
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/seller-tracker',
  method: 'GET'
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const sellerId = data.data && data.data[0] ? data.data[0]._id : null;
      console.log("Seller:", sellerId);
      
      if (sellerId) {
        const syncOptions = {
          hostname: 'localhost',
          port: 5001,
          path: '/api/seller-tracker/sync/' + sellerId,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        const syncReq = http.request(syncOptions, res2 => {
          let b2 = '';
          res2.on('data', d => b2 += d);
          res2.on('end', () => console.log("Sync response:", res2.statusCode, b2));
        });
        syncReq.end("{}");
      }
    } catch(e) { console.log(e); }
  });
});
req.on('error', e => console.error(e));
req.end();

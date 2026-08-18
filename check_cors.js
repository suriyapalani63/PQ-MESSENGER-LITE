const http = require('https');

const options = {
  hostname: 'pq-messenger-lite.onrender.com',
  path: '/health',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://pq-messenger-lite.netlify.app',
    'Access-Control-Request-Method': 'GET'
  }
};

const req = http.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
});

req.on('error', (e) => {
  console.error('Problem with request:', e.message);
});

req.end();

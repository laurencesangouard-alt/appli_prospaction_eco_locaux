const http = require('http');

const payload = JSON.stringify({
  url: 'https://lsangouard.app.n8n.cloud/webhook/send-email-contact',
  payload: {
    contact_id: 'test-uuid-123',
    commercial_id: 'lsangouard@gmail.com',
    subject: 'Test via PROXY',
    email_body: 'Test pour voir si le proxy cause l\'erreur 400.'
  }
});

const options = {
  hostname: 'localhost',
  port: 3210,
  path: '/proxy-n8n',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('🚀 Envoi vers le PROXY LOCAL (port 3210)...');

const req = http.request(options, (res) => {
  let data = '';
  console.log(`📥 Status Code du Proxy: ${res.statusCode}`);
  
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('📥 Réponse du Proxy :', data);
  });
});

req.on('error', (e) => {
  console.error(`🔥 Erreur : Le serveur local n'est peut-être pas lancé sur le port 3210. Message : ${e.message}`);
});

req.write(payload);
req.end();

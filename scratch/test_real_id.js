const http = require('http');

const payload = JSON.stringify({
  url: 'https://lsangouard.app.n8n.cloud/webhook/send-email-contact',
  payload: {
    contact_id: '015843f0-54b9-4b5e-abfe-de52919a929b',
    commercial_id: 'lsangouard@gmail.com',
    subject: 'Test Réel via PROXY',
    email_body: 'Test avec un ID de contact réel pour diagnostiquer l\'erreur 400.'
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

console.log('🚀 Envoi vers le PROXY LOCAL avec un VRAI ID...');

const req = http.request(options, (res) => {
  let data = '';
  console.log(`📥 Status Code: ${res.statusCode}`);
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('📥 Réponse :', data);
  });
});

req.on('error', (e) => console.error(`🔥 Erreur : ${e.message}`));
req.write(payload);
req.end();

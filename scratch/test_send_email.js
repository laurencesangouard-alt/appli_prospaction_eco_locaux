const https = require('https');

const payload = JSON.stringify({
  contact_id: 'test-uuid-123',
  commercial_id: 'lsangouard@gmail.com',
  subject: 'Test depuis Antigravity',
  email_body: 'Ceci est un test pour diagnostiquer l\'erreur 400.'
});

const options = {
  hostname: 'lsangouard.app.n8n.cloud',
  port: 443,
  path: '/webhook/send-email-contact',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('🚀 Tentative d\'envoi vers n8n...');

const req = https.request(options, (res) => {
  let data = '';
  console.log(`📥 Status Code: ${res.statusCode}`);
  
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('📥 Réponse de n8n :', data);
    if (res.statusCode === 400) {
      console.log('❌ Erreur 400 confirmée. Vérifiez le format du JSON ou les champs obligatoires dans n8n.');
    }
  });
});

req.on('error', (e) => {
  console.error(`🔥 Erreur réseau : ${e.message}`);
});

req.write(payload);
req.end();

const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url, payload } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL' });
    }

    console.log(`🚀 [PROXY Vercel] Envoi vers : ${url}`);
    
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(payload || {});
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData, 'utf8'),
      },
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const n8nReq = protocol.request(options, (n8nRes) => {
      let respBody = '';
      n8nRes.on('data', chunk => { respBody += chunk; });
      n8nRes.on('end', () => {
        console.log(`📥 [PROXY Vercel] Réponse n8n (${n8nRes.statusCode})`);
        res.status(n8nRes.statusCode);
        try {
          if (respBody) JSON.parse(respBody);
          res.send(respBody || '{}');
        } catch (e) {
          res.json({ status: 'ok', data: respBody });
        }
      });
    });

    n8nReq.on('error', (e) => {
      console.error(`❌ [PROXY Vercel] Erreur : ${e.message}`);
      res.status(500).json({ error: e.message });
    });

    n8nReq.write(postData, 'utf8');
    n8nReq.end();
  } catch (e) {
    console.error(`❌ [PROXY Vercel] Erreur fatale : ${e.message}`);
    res.status(500).json({ error: e.message });
  }
};

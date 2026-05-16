const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3210;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  const ext  = path.extname(filePath);

  // --- PROXY n8n pour éviter CORS ---
  if (req.method === 'POST' && (urlPath === '/proxy-n8n' || urlPath === '/api/proxy-n8n')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { url, payload } = JSON.parse(body);
        const parsedUrl = new URL(url);
        const postData = JSON.stringify(payload || {});
        
        console.log(`\n🚀 [PROXY] Envoi vers n8n : ${url}`);
        console.log(`📦 [PROXY] Body :`, postData);

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData, 'utf8'),
          },
        };

        const protocol = parsedUrl.protocol === 'https:' ? require('https') : require('http');
        const n8nReq = protocol.request(options, (n8nRes) => {
          let respBody = '';
          n8nRes.on('data', chunk => { respBody += chunk; });
          n8nRes.on('end', () => {
            console.log(`📥 [PROXY] Réponse n8n (${n8nRes.statusCode}) :`, respBody);
            res.writeHead(n8nRes.statusCode, { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*' 
            });
            // On renvoie la réponse telle quelle si c'est déjà du JSON, sinon on l'emballe proprement
            try {
              if (respBody) JSON.parse(respBody);
              res.end(respBody || '{}');
            } catch (e) {
              res.end(JSON.stringify({ status: 'ok', data: respBody }));
            }
          });
        });

        n8nReq.on('error', (e) => {
          console.error('❌ [PROXY] Erreur n8n:', e.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        });

        n8nReq.write(postData, 'utf8');
        n8nReq.end();
      } catch (e) {
        console.error('❌ [PROXY] Erreur parse proxy:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const mime = MIME[ext] || 'text/plain';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅  ProspAction serveur démarré`);
  console.log(`   http://localhost:${PORT}\n`);
});

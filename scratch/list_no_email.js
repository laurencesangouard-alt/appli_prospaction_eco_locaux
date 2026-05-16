const https = require('https');

const url = 'https://cocvueemnrmwrironirb.supabase.co/rest/v1/contacts?select=nom,ville&email=is.null';
const options = {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvY3Z1ZWVtbnJtd3Jpcm9uaXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTkzMzEsImV4cCI6MjA5MTczNTMzMX0.LH7mfHbq5RXQI7mOA08gppdDNxG_3sMSwO7y_8E34io'
  }
};

https.get(url, options, (res) => {
  let d = '';
  res.on('data', chunk => d += chunk);
  res.on('end', () => {
    try {
      const list = JSON.parse(d);
      console.log('\n❌ CONTACTS SANS EMAIL DANS SUPABASE :');
      if (list.length === 0) {
        console.log('Félicitations ! Tous vos contacts ont un email.');
      } else {
        list.forEach(c => console.log(`- ${c.nom || 'Sans nom'} (${c.ville || 'Ville inconnue'})`));
      }
    } catch (e) {
      console.error('Erreur lecture Supabase');
    }
  });
});

/**
 * config.js — Configuration ProspAction Eco Locaux
 * ⚠️  Remplissez vos propres clés ici avant le déploiement
 */
const CONFIG = {
  // Supabase
  SUPABASE_URL:    'https://cocvueemnrmwrironirb.supabase.co',
  SUPABASE_ANON:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvY3Z1ZWVtbnJtd3Jpcm9uaXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTkzMzEsImV4cCI6MjA5MTczNTMzMX0.LH7mfHbq5RXQI7mOA08gppdDNxG_3sMSwO7y_8E34io',

  // n8n webhooks
  N8N_BASE:        'https://lsangouard.app.n8n.cloud',
  WEBHOOK_SEARCH:  '/webhook/recherche_leads_v2',
  WEBHOOK_ENRICH:  '/webhook/enrich-contact',
  WEBHOOK_EMAIL:   '/webhook/generer_email',
  WEBHOOK_SEND:    '/webhook/send-email-contact',

  // App
  MAX_LEADS:       5,
  RELANCE_DAYS:    5,

  // Activités disponibles
  ACTIVITIES_FALLBACK: [
    'Restaurant', 'Hôtel', 'Boulangerie', 'Salon de coiffure', 'Garage automobile',
    'Cabinet médical', 'Pharmacie', 'Supermarché', 'Bar / Café', 'Épicerie',
    'Fleuriste', 'Librairie', 'Agence immobilière', 'Bureau d\'avocats',
    'Cabinet comptable', 'Centre sportif', 'École privée', 'Crèche',
    'Artisan bâtiment', 'Plombier', 'Électricien', 'Peintre', 'Menuisier',
    'Couvreur', 'Charpentier', 'Maçon',
  ],
};

/**
 * api.js — Appels webhooks n8n
 */
const API = (() => {
  const base = () => CONFIG.N8N_BASE;

  async function post(path, payload) {
    const fullUrl = path.startsWith('http') ? path : `${base()}${path}`;
    
    console.log(`\n🚀 [API] Envoi vers : ${fullUrl}`);
    console.log(`📦 [API] Payload :`, payload);

    // On passe par le proxy (local ou Vercel) pour éviter les erreurs CORS
    const res = await fetch('/api/proxy-n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fullUrl, payload }),
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('❌ [API] Erreur proxy:', err);
      throw new Error(err.message || `Erreur proxy ${res.status}`);
    }
    
    const text = await res.text();
    console.log('📥 [API] Réponse brute reçue :', text);

    let json = {};
    try {
      json = text ? JSON.parse(text) : { success: true };
    } catch (e) {
      // Si ce n'est pas du JSON, on considère que c'est un succès si status est ok
      json = { success: res.ok, raw: text };
    }

    if (!res.ok) {
      throw new Error(json.message || `Erreur ${res.status}`);
    }

    return json;
  }

  /** Étape 3 : Recherche prospects via n8n */
  async function searchProspects(activity, city, userId) {
    return post(CONFIG.WEBHOOK_SEARCH, { 
      activite: activity, 
      localisation: city 
    });
  }

  /** Étape 7 : Enrichissement contact (scraping email depuis site web) */
  async function enrichContact(contactId) {
    return post(CONFIG.WEBHOOK_ENRICH, { contact_id: contactId });
  }

  /** Étape 8 : Génération email IA */
  async function generateEmail(contact) {
    return post(CONFIG.WEBHOOK_EMAIL, {
      company:  contact.nom      || contact.name     || '',
      activity: contact.activite || contact.activity  || '',
      location: contact.ville    || contact.city      || '',
      rating:   contact.note_google || contact.google_rating || '',
      offer:    'Eco-Locaux efficacité énergétique',
    });
  }

  /** Étape 10 : Envoi email validé (VIA PROXY) */
  async function sendEmail(contactId, commercialId, subject, emailBody) {
    return post(CONFIG.WEBHOOK_SEND, {
      contact_id: contactId,
      commercial_id: commercialId,
      subject: subject,
      email_body: emailBody
    });
  }

  return { searchProspects, enrichContact, generateEmail, sendEmail };
})();

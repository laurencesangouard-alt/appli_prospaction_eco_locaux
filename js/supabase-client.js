/**
 * supabase-client.js — Client Supabase léger (sans SDK)
 * Utilise l'API REST Supabase directement via fetch
 */
const SupabaseClient = (() => {
  // Mode test : token fictif (mock-*) ou clé anonyme Supabase
  const isMockToken  = (token) => token && token.startsWith('mock-');
  const isTestMode   = (token) => isMockToken(token) || token === CONFIG.SUPABASE_ANON;

  const url = () => CONFIG.SUPABASE_URL;
  const key = () => CONFIG.SUPABASE_ANON;

  const headers = (extra = {}) => ({
    'apikey': key(),
    'Content-Type': 'application/json',
    ...extra,
  });

  const authHeaders = (token, extra = {}) => ({
    ...headers(extra),
    'Authorization': `Bearer ${token}`,
  });

  // ── Auth ──────────────────────────────────────────────────────
  async function signIn(email, password) {
    const res = await fetch(`${url()}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.message || 'Erreur de connexion');
    return data; // { access_token, refresh_token, user, ... }
  }

  async function signOut(token) {
    await fetch(`${url()}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  }

  async function resetPasswordForEmail(email) {
    const res = await fetch(`${url()}/auth/v1/recover`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Erreur lors de la demande de récupération');
    }
    return true;
  }

  async function signInWithOtp(email) {
    const res = await fetch(`${url()}/auth/v1/otp`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, create_user: false }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Erreur lors de l\'envoi du lien');
    }
    return true;
  }

  async function getUser(token) {
    const res = await fetch(`${url()}/auth/v1/user`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return null;
    return res.json();
  }

  // ── Database REST ─────────────────────────────────────────────
  async function query(token, table, params = {}) {
    const qp = new URLSearchParams();
    if (params.select) qp.set('select', params.select);
    if (params.order) qp.set('order', params.order);
    if (params.limit) qp.set('limit', String(params.limit));
    if (params.offset) qp.set('offset', String(params.offset));

    // Filters: { column: 'eq.value' }
    if (params.filters) {
      for (const [col, val] of Object.entries(params.filters)) {
        qp.set(col, val);
      }
    }

    const headersConfig = { 'Prefer': params.method === 'GET' ? undefined : 'return=representation' };
    if (params.method === 'GET') delete headersConfig['Prefer'];

    const res = await fetch(`${url()}/rest/v1/${table}?${qp}`, {
      headers: authHeaders(token, headersConfig),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(`❌ Erreur Supabase HTTP ${res.status} sur ${table}:`, errData);
      if (res.status === 401) {
        if (isTestMode(token)) {
          // En mode test, on ignore les erreurs 401 (pas de redirection)
          console.warn('⚠️ Mode test : accès refusé (role anon), données vides');
          return [];
        }
        console.warn('⚠️ Session expirée ou invalide. Redirection vers login...');
        sessionStorage.removeItem('prosp_session');
        window.location.href = 'index.html';
      }
      return { error: errData.message || `Erreur ${res.status}`, status: res.status };
    }
    return res.json();
  }

  async function insert(token, table, data) {
    const res = await fetch(`${url()}/rest/v1/${table}`, {
      method: 'POST',
      headers: authHeaders(token, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`❌ Erreur INSERT Supabase sur ${table}:`, err);
      console.error('💡 hint:', err.hint);
      console.error('📋 details:', err.details);
      throw new Error(err.message || `Erreur insert ${res.status}`);
    }
    return res.json();
  }

  async function update(token, table, id, data) {
    const res = await fetch(`${url()}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: authHeaders(token, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`❌ Erreur UPDATE Supabase sur ${table}:`, err);
      console.error('💡 hint:', err.hint);
      console.error('📋 details:', err.details);
      throw new Error(err.message || `Erreur update ${res.status}`);
    }
    return res.json();
  }

  async function upsert(token, table, data, onConflict = 'id') {
    const res = await fetch(`${url()}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: authHeaders(token, {
        'Prefer': `return=representation,resolution=merge-duplicates`,
      }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erreur upsert ${res.status}`);
    }
    return res.json();
  }

  // ── Helpers métier ─────────────────────────────────────────────
  // Nom de la table et de la colonne activité dans Supabase
  const ACTIVITES_TABLE = 'recherche';
  const ACTIVITES_COLUMN = 'activite';

  async function getActivities(token) {
    try {
      const rows = await query(token, ACTIVITES_TABLE, {
        select: ACTIVITES_COLUMN
      });
      console.log('📊 Supabase RAW data:', rows);

      if (!rows || rows.error) {
        console.error('❌ Erreur Supabase ou données vides:', rows?.error || 'No data');
        return CONFIG.ACTIVITIES_FALLBACK;
      }

      const vals = rows
        .map(r => r[ACTIVITES_COLUMN])
        .filter(Boolean);
      console.log('✨ Activités extraites:', vals.length);
      const unique = [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'fr'));
      return unique.length ? unique : CONFIG.ACTIVITIES_FALLBACK;
    } catch (err) {
      console.error('🔥 Erreur CRITIQUE getActivities:', err);
      return CONFIG.ACTIVITIES_FALLBACK;
    }
  }

  async function getContacts(token, userId, filters = {}) {
    // Uniquement pour les tokens totalement fictifs (mock-*) : données de démo
    if (isMockToken(token)) {
      console.log('🧪 Token mock détecté : données fictives');
      return [
        { id: 'mock-1', nom: 'Boulangerie Dupont', activite: 'Boulangerie', ville: 'Lyon', telephone: '04 78 00 00 01', note_google: 4.5, statut: 'nouveau_lead', date_relance: null },
        { id: 'mock-2', nom: 'Restaurant Le Provençal', activite: 'Restaurant', ville: 'Marseille', telephone: '04 91 00 00 02', note_google: 4.2, statut: 'nouveau_lead', date_relance: null },
        { id: 'mock-3', nom: 'Pressing Martin', activite: 'Pressing', ville: 'Paris', telephone: '01 42 00 00 03', note_google: 4.0, statut: 'a_relancer', date_relance: '2026-05-10' },
      ];
    }

    // Pour la clé anon (mode test) et les vrais tokens : requête Supabase réelle
    const f = {};
    const statusVal = filters.statut || filters.status;
    if (statusVal) f['statut'] = `eq.${statusVal}`;
    if (filters.activite) f['activite'] = `eq.${filters.activite}`;
    if (filters.ville) f['ville'] = `eq.${filters.ville}`;
    if (filters.nom) f['nom'] = `ilike.*${filters.nom}*`;

    const rows = await query(token, 'contacts', {
      select: '*',
      order: 'created_at.desc',
      filters: f,
    });
    
    // Log pour diagnostiquer les valeurs de statut réellement en base
    if (Array.isArray(rows) && rows.length > 0) {
      const statuts = [...new Set(rows.map(r => r.statut).filter(Boolean))];
      console.log('🔑 Valeurs de statut en base : "' + statuts.join('" | "') + '"');
      console.log('🔑 JSON:', JSON.stringify(statuts));
    }
    return rows;
  }

  async function updateContactStatus(token, id, statut, extra = {}) {
    return update(token, 'contacts', id, { statut, ...extra });
  }

  async function insertInteraction(token, data) {
    return insert(token, 'interactions', data);
  }

  return {
    signIn, signOut, resetPasswordForEmail, signInWithOtp, getUser,
    query, insert, update, upsert,
    getActivities, getContacts,
    updateContactStatus, insertInteraction,
  };
})();

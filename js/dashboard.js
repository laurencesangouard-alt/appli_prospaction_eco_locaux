/**
 * dashboard.js — Logique page Dashboard (recherche + contacts)
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;

  const token  = Auth.getToken();
  const userId = Auth.getUserId();

  // State
  let allContacts    = [];
  let searchResults  = []; // Résultats volatils de la recherche n8n
  let selectedIds    = new Set();
  let selectedIndices = new Set(); // Pour la recherche volatile (sans IDs)
  let currentContact = null;
  let isSearchMode   = false; // Pour savoir si on affiche des résultats n8n ou des contacts DB

  // ── Populate activities dropdown ──────────────────────────────
  async function loadActivities() {
    const sel = document.getElementById('activity-select');
    if (!sel) return;
    const currentVal = sel.value;

    // Tente de charger depuis Supabase, sinon utilise le fallback de config.js
    let activities = CONFIG.ACTIVITIES_FALLBACK;
    try {
      const fromDB = await SupabaseClient.getActivities(token);
      if (fromDB && fromDB.length > 0) activities = fromDB;
    } catch (e) {
      console.warn('Table activities absente dans Supabase, utilisation du fallback config.js');
    }

    sel.innerHTML = `<option value="">— Secteur d'activité —</option>` +
      activities.map(a => `<option value="${a}"${a === currentVal ? ' selected' : ''}>${a}</option>`).join('');
  }

  // ── Load contacts table (Sas de tri) ─────────────────────────
  async function loadContacts(status = '', activity = '', city = '') {
    isSearchMode = false;
    selectedIndices.clear();
    const tbody   = document.getElementById('contacts-tbody');
    const subtitle = document.getElementById('contacts-subtitle');
    
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty"><span class="skeleton" style="display:inline-block;width:160px;height:14px"></span></td></tr>`;
    try {
      const filters = {};
      if (status) filters.status = status;
      if (activity) filters.activite = activity;
      if (city) filters.ville = city;
      allContacts = await SupabaseClient.getContacts(token, userId, filters);
      if (allContacts.length > 0) {
        console.log('📋 Structure réelle d\'un contact en base :', allContacts[0]);
      }
      
      // Limiter à 5 nouveaux contacts
      const displayed = allContacts.slice(0, 5);
      const total = allContacts.length;
      subtitle.textContent = total > 0
        ? `${displayed.length} nouveau${displayed.length !== 1 ? 'x' : ''} contact${displayed.length !== 1 ? 's' : ''}${total > 5 ? ` affichés sur ${total}` : ' trouvé' + (displayed.length !== 1 ? 's' : '')}`
        : '0 nouveau contact trouvé';
      
      selectedIds.clear();
      updateValidateBtn();
      renderContactsTable(displayed);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Erreur : ${escHtml(err.message)}</td></tr>`;
    }
  }

  function renderContactsTable(contacts) {
    const tbody = document.getElementById('contacts-tbody');
    if (!contacts.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">${isSearchMode ? 'Aucun résultat trouvé.' : 'Aucun nouveau contact. Lancez une recherche !'}</td></tr>`;
      return;
    }
    tbody.innerHTML = contacts.map((c, idx) => {
      const id = isSearchMode ? idx : c.id;
      const isSelected = isSearchMode ? selectedIndices.has(idx) : selectedIds.has(c.id);
      const isPast = isOverdue(c.date_relance);
      return `
        <tr class="${isSelected ? 'bg-primary/5' : ''}">
          <td class="px-6 py-3">
            <a href="fiche.html?id=${c.id}" class="table-name hover:text-primary transition-colors cursor-pointer" style="text-decoration:none; font-weight:500">
              ${escHtml(c.nom || c.name || 'Sans nom')}
            </a>
          </td>
          <td class="px-6 py-3">${escHtml(c.activite || c.activity || '—')}</td>
          <td class="px-6 py-3">${escHtml(c.ville || c.city || '—')}</td>
          <td class="px-6 py-3 text-sm">${escHtml(c.telephone || c.phone || '—')}</td>
          <td class="px-6 py-3 text-sm">${escHtml(c.email || c['e-mail'] || '—')}</td>
          <td class="px-6 py-3">${(c.note_google || c.google_rating || c.rating) ? `<span class="rating-badge">★ ${parseFloat(c.note_google || c.google_rating || c.rating).toFixed(1)}</span>` : '—'}</td>
          <td class="px-6 py-3">
            <a href="fiche.html?id=${c.id}" class="cursor-pointer" style="text-decoration:none">
              ${statusChip(c.statut || c.status || (isSearchMode ? 'À trier' : 'Nouveau lead'))}
            </a>
          </td>
          <td class="text-right px-8 py-3">
            <input type="checkbox" class="contact-checkbox w-5 h-5 rounded border-stone-300 text-primary focus:ring-primary cursor-pointer" 
                   data-id="${id}" data-idx="${idx}" ${isSelected ? 'checked' : ''} title="Sélectionner pour validation" />
          </td>
        </tr>
      `;
    }).join('');

    // Listeners checkboxes
    tbody.querySelectorAll('.contact-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        if (isSearchMode) {
          const idx = parseInt(e.target.dataset.idx);
          if (e.target.checked) selectedIndices.add(idx);
          else selectedIndices.delete(idx);
        } else {
          const id = e.target.dataset.id;
          if (e.target.checked) selectedIds.add(id);
          else selectedIds.delete(id);
        }
        updateValidateBtn();
        e.target.closest('tr').classList.toggle('bg-primary/5', e.target.checked);
      });
    });
  }

  function updateValidateBtn() {
    const btn = document.getElementById('validate-bulk-btn');
    if (btn) {
      const count = isSearchMode ? selectedIndices.size : selectedIds.size;
      btn.classList.toggle('hidden', count === 0);
      btn.innerHTML = `<span class="material-symbols-outlined text-sm" style="font-size:18px">check_circle</span> Valider ${count} sélectionné${count > 1 ? 's' : ''}`;
    }
  }

  document.getElementById('validate-bulk-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('validate-bulk-btn');
    btn.disabled = true;
    btn.textContent = 'Validation…';
    try {
      if (isSearchMode) {
        // --- Mode RECHERCHE ---
        if (!userId) throw new Error("Utilisateur non authentifié (ID manquant)");
        const indices = [...selectedIndices];
        for (const idx of indices) {
          const lead = searchResults[idx];
          const name = (lead.nom || lead.name || lead.title || 'Sans nom').trim();
          const dataToInsert = { 
            nom: name,
            prenom: (lead.prenom || '').trim(),
            activite: (lead.activite || lead.activity || lead.category || activity).trim(),
            adresse: (lead.adresse || lead.address || '').trim(),
            ville: (lead.ville || lead.city || city).trim(),
            email: (lead.email || lead['e-mail'] || '').trim(),
            telephone: (lead.telephone || lead.phone || '').trim(),
            site_web: (lead.site_web || lead.website || lead.url || '').trim(),
            user_id: userId,
            commercial_responsable: Auth.getUser()?.email || ''
          };
          const rat = parseFloat(lead.note_google || lead.google_rating || lead.rating);
          if (!isNaN(rat) && rat > 0) dataToInsert.note_google = rat;

          try {
            await SupabaseClient.insert(token, 'contacts', dataToInsert);
          } catch (e) {
            console.error('❌ Erreur insertion:', e.message);
            throw e;
          }
        }
        showToast(`${indices.length} contact${indices.length > 1 ? 's' : ''} ajouté${indices.length > 1 ? 's' : ''} !`, 'success');
      } else {
        // --- Mode GESTION ---
        const ids = [...selectedIds];
        for (const id of ids) {
          try {
            await SupabaseClient.updateContactStatus(token, id, 'nouveau_lead');
          } catch (e) {
            console.error('❌ Erreur update statut:', e.message);
            throw e;
          }
        }
        const displayedIds = allContacts.slice(0, 5).map(c => String(c.id));
        const otherIds = displayedIds.filter(id => !selectedIds.has(id));
        for (const id of otherIds) {
          await SupabaseClient.updateContactStatus(token, id, 'en_attente');
        }
        showToast(`${ids.length} contact${ids.length > 1 ? 's' : ''} validé${ids.length > 1 ? 's' : ''} !`, 'success');
      }

      selectedIds.clear();
      selectedIndices.clear();
      await loadContacts(); // Repasse en mode isSearchMode = false
    } catch (err) {
      console.error('Erreur validation détaillée:', err);
      showToast('Erreur : ' + (err.message || 'Problème de validation'), 'error');
    } finally {
      btn.disabled = false;
      updateValidateBtn();
    }
  });

  // ── Extraction multi-format de la réponse webhook n8n ──────────
  function extractProspects(data) {
    // Format 1 : tableau direct
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object') {
        if (Array.isArray(data[0].prospects)) return data[0].prospects;
        if (Array.isArray(data[0].nouveaux))  return data[0].nouveaux;
        if (Array.isArray(data[0].contacts))  return data[0].contacts;
        if (Array.isArray(data[0].data))      return data[0].data;
      }
      return data; // tableau direct de prospects
    }
    // Format 2 : objet enveloppe
    if (data && typeof data === 'object') {
      if (Array.isArray(data.prospects)) return data.prospects;
      if (Array.isArray(data.nouveaux))  return data.nouveaux;
      if (Array.isArray(data.contacts))  return data.contacts;
      if (Array.isArray(data.data))      return data.data;
      if (Array.isArray(data.results))   return data.results;
      if (Array.isArray(data.leads))     return data.leads;
    }
    return [];
  }

  // ── Panneau debug JSON (visible dans l'UI) ───────────────────

  // ── Search form ───────────────────────────────────────────────
  document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activity = document.getElementById('activity-select').value.trim();
    const city     = document.getElementById('city-input').value.trim();

    if (!activity) { showAlert('Veuillez choisir une activité.'); return; }
    if (!city)     { showAlert('Veuillez saisir une ville.'); return; }
    hideAlert();

    // 1. Vider l'affichage courant + fermer debug

    // 2. Afficher l'état "Recherche en cours…"
    const btn = document.getElementById('search-btn');
    setLoading('search-btn-text', 'search-spinner', true, 'Recherche…');
    btn.disabled = true;

    try {
      console.log('🚀 Appel webhook n8n :', { activite: activity, localisation: city });
      
      let webhookRaw = null;
      try {
        // 1. Déclenchement du webhook (on ne bloque pas sur le contenu de la réponse)
        webhookRaw = await API.searchProspects(activity, city, userId);
        console.log('📥 Réponse Webhook reçue');
      } catch (e) {
        console.warn('⚠️ Webhook inaccessible ou erreur réseau, on vérifie quand même la DB');
      }

      // 2. Rechargement systématique depuis Supabase (sans filtre de statut pour tout voir)
      await loadContacts('', activity, city);

      // 3. Gestion de l'affichage final
      if (allContacts.length > 0) {
        // Succès : on a des données en base (nouvelles ou anciennes)
        hideAlert();
        
        // Message spécifique si le webhook confirme qu'il n'y a rien de NOUVEAU
        if (webhookRaw && webhookRaw.count === 0) {
          showToast("Aucun nouveau contact ajouté, contacts déjà existants", 'info');
        } else {
          showToast(`${allContacts.length} contact${allContacts.length > 1 ? 's' : ''} trouvé${allContacts.length > 1 ? 's' : ''}`, 'success');
        }
      } else {
        // Échec réel : rien en base
        showAlert("Aucun contact trouvé", 'info');
      }


    } catch (err) {
      console.error('🔥 Erreur système lors de la recherche :', err);
      showAlert(`Erreur système : ${err.message}`, 'error');
    } finally {
      setLoading('search-btn-text', 'search-spinner', false, 'Rechercher');
      btn.disabled = false;
    }
  });



  // ── Enrich one contact ────────────────────────────────────────
  window.enrichOne = async function(id) {
    const indicator = document.getElementById(`enrich-${id}`);
    if (indicator) {
      indicator.className = 'enrich-indicator loading';
      indicator.innerHTML = `<svg class="spinner" width="10" height="10" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="14" stroke-linecap="round"/></svg> Enrichissement…`;
    }
    try {
      await API.enrichContact(id);
      if (indicator) {
        indicator.className = 'enrich-indicator done';
        indicator.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Enrichi`;
      }
      showToast('Email extrait du site web', 'success');
      await loadContacts();
    } catch (err) {
      if (indicator) {
        indicator.className = 'enrich-indicator pending';
        indicator.innerHTML = `Échec`;
      }
      showToast(`Enrichissement échoué : ${err.message}`, 'error');
    }
  };

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadContacts();
  });

  // ── Email modal ───────────────────────────────────────────────
  window.openEmailModal = function(contactId) {
    const contact = [...newProspects, ...allContacts].find(c => c.id === contactId);
    if (!contact) { showToast('Contact introuvable', 'error'); return; }
    currentContact = contact;

    document.getElementById('email-contact-name').textContent = contact.name;
    document.getElementById('email-generate-step').classList.remove('hidden');
    document.getElementById('email-editor-step').classList.add('hidden');
    document.getElementById('email-modal-footer').classList.add('hidden');
    document.getElementById('email-subject').value = '';
    document.getElementById('email-body').value = '';
    openModal('email-modal-overlay');
  };

  document.getElementById('generate-email-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    setLoading('generate-email-btn-text', 'generate-spinner', true, 'Génération…');
    document.getElementById('generate-email-btn').disabled = true;
    try {
      const result = await API.generateEmail(currentContact);
      const subject = result.subject || result.objet || '';
      const body    = result.body || result.corps || result.email || '';
      document.getElementById('email-subject').value = subject;
      document.getElementById('email-body').value    = body;
      document.getElementById('email-generate-step').classList.add('hidden');
      document.getElementById('email-editor-step').classList.remove('hidden');
      document.getElementById('email-modal-footer').classList.remove('hidden');
    } catch (err) {
      showToast(`Génération IA échouée : ${err.message}`, 'error');
    } finally {
      setLoading('generate-email-btn-text', 'generate-spinner', false, 'Générer l\'email');
      document.getElementById('generate-email-btn').disabled = false;
    }
  });

  document.getElementById('regenerate-btn').addEventListener('click', () => {
    document.getElementById('email-generate-step').classList.remove('hidden');
    document.getElementById('email-editor-step').classList.add('hidden');
    document.getElementById('email-modal-footer').classList.add('hidden');
  });

  document.getElementById('validate-send-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    const subject = document.getElementById('email-subject').value.trim();
    const body    = document.getElementById('email-body').value.trim();
    if (!subject || !body) { showToast('Objet et corps requis.', 'error'); return; }

    setLoading('send-btn-text', 'send-spinner', true, 'Envoi…');
    document.getElementById('validate-send-btn').disabled = true;
    try {
      await API.sendEmail(currentContact.id, userId, subject, body);
      // Mise à jour statut + date_relance
      const dateRelance = workingDaysFromNow(CONFIG.RELANCE_DAYS);
      await SupabaseClient.updateContactStatus(token, currentContact.id, 'email_envoye', { date_relance: dateRelance });
      await SupabaseClient.insertInteraction(token, {
        contact_id: currentContact.id,
        type:       'email',
        content:    `Objet : ${subject}`,
      });
      showToast('Email envoyé avec succès !', 'success');
      closeModal('email-modal-overlay');
      await loadContacts(document.getElementById('status-filter').value);
    } catch (err) {
      showToast(`Envoi échoué : ${err.message}`, 'error');
    } finally {
      setLoading('send-btn-text', 'send-spinner', false, 'Valider & Envoyer');
      document.getElementById('validate-send-btn').disabled = false;
    }
  });

  // ── RDV modal ─────────────────────────────────────────────────
  window.openRdvModal = function(contactId) {
    const contact = [...newProspects, ...allContacts].find(c => c.id === contactId);
    if (!contact) return;
    currentContact = contact;
    document.getElementById('rdv-contact-name').textContent = contact.name;
    document.getElementById('rdv-date').value = '';
    document.getElementById('rdv-time').value = '';
    document.getElementById('rdv-note').value = '';
    openModal('rdv-modal-overlay');
  };

  // Le bouton cancel est géré par onclick dans le HTML

  document.getElementById('rdv-confirm-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    const date = document.getElementById('rdv-date').value;
    const time = document.getElementById('rdv-time').value;
    const note = document.getElementById('rdv-note').value.trim();
    if (!date || !time) { showToast('Date et heure requises.', 'error'); return; }

    try {
      await SupabaseClient.updateContactStatus(token, currentContact.id, 'rdv_planifie');
      await SupabaseClient.insertInteraction(token, {
        contact_id: currentContact.id,
        type:       'rdv',
        content:    `RDV le ${date} à ${time}${note ? ' — ' + note : ''}`,
      });
      showToast('RDV planifié !', 'success');
      closeModal('rdv-modal-overlay');
      await loadContacts(document.getElementById('status-filter').value);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  });

  // ── Init ──────────────────────────────────────────────────────
  await loadActivities();
  await loadContacts();
});

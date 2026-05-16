/**
 * pipeline.js — Kanban drag & drop pipeline commercial
 */
document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;

  const token  = Auth.getToken();
  const userId = Auth.getUserId();

  const COLUMNS = [
    { id: 'nouveau_lead', label: 'Nouveau lead', accent: 'accent-nouveau' },
    { id: 'a_relancer',   label: 'À relancer',   accent: 'accent-relancer' },
    { id: 'rdv_planifie', label: 'RDV planifié', accent: 'accent-rdv' },
  ];

  let allContacts    = [];
  let currentContact = null;
  let dragContactId  = null;
  let placeholder    = null;

  // ── Build Kanban board ────────────────────────────────────────
  function buildBoard() {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';
    COLUMNS.forEach(col => {
      const colEl = document.createElement('div');
      colEl.className = 'kanban-col';
      colEl.dataset.status = col.id;
      colEl.innerHTML = `
        <div class="kanban-col-header">
          <span class="kanban-col-title">${escHtml(col.label)}</span>
          <span class="kanban-col-count" id="count-${col.id.replace(/\s/g,'-')}">0</span>
        </div>
        <div class="kanban-col-accent ${col.accent}"></div>
        <div class="kanban-cards" id="cards-${col.id.replace(/\s/g,'-')}" data-status="${col.id}"></div>
      `;
      board.appendChild(colEl);

      // Drop zone events
      const zone = colEl.querySelector('.kanban-cards');
      zone.addEventListener('dragover',  onDragOver);
      zone.addEventListener('dragleave', onDragLeave);
      zone.addEventListener('drop',      onDrop);
    });
  }

  // ── Load contacts ─────────────────────────────────────────────
  async function loadContacts() {
    try {
      allContacts = await SupabaseClient.getContacts(token, userId);
      renderBoard();
      updateStats();
      renderOverdue();
    } catch (err) {
      showToast(`Erreur chargement : ${err.message}`, 'error');
    }
  }

  function renderOverdue() {
    const overdue = allContacts
      .filter(c => isOverdue(c.date_relance))
      .sort((a,b) => b.date_relance.localeCompare(a.date_relance));

    const section = document.getElementById('overdue-section');
    const list = document.getElementById('overdue-list');
    
    if (!overdue.length) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    list.innerHTML = overdue.map(c => {
      const dateStr = fmtDate(c.date_relance);
      return `
      <div class="overdue-card flex flex-col gap-2 cursor-pointer" onclick="openContactModal('${c.id}')">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h4 class="font-bold text-stone-900 truncate text-sm">${escHtml(c.nom || c.name || 'Sans nom')}</h4>
            <p class="text-[11px] text-stone-500 truncate">${escHtml(c.activite || c.activity || '')} · ${escHtml(c.ville || c.city || '')}</p>
          </div>
          <span class="overdue-badge shrink-0">Retard</span>
        </div>
        <div class="flex items-center justify-between mt-1 pt-2 border-t border-stone-100">
          <span class="text-[11px] font-bold text-red-600 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">calendar_today</span>
            Relance : ${dateStr}
          </span>
          <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation(); window.location.href='email-assistant.html?id=${c.id}'" class="p-1.5 hover:bg-stone-50 rounded-lg text-amber-600 transition-colors" title="Email IA">
              <span class="material-symbols-outlined text-lg">auto_awesome</span>
            </button>
            <button onclick="event.stopPropagation(); window.location.href='fiche.html?id=${c.id}'" class="p-1.5 hover:bg-stone-50 rounded-lg text-primary transition-colors" title="Voir fiche">
              <span class="material-symbols-outlined text-lg">visibility</span>
            </button>
          </div>
        </div>
      </div>
      `;
    }).join('');
  }

  // ── Render board ──────────────────────────────────────────────
  function renderBoard() {
    // Clear cards
    COLUMNS.forEach(col => {
      const zoneId = `cards-${col.id.replace(/\s/g,'-')}`;
      const zone   = document.getElementById(zoneId);
      if (zone) zone.innerHTML = '';
    });

    allContacts.forEach(c => {
      const status = c.statut || c.status || 'nouveau_lead';
      const col    = COLUMNS.find(x => x.id === status) || COLUMNS[0];
      const zoneId = `cards-${col.id.replace(/\s/g,'-')}`;
      const zone   = document.getElementById(zoneId);
      if (!zone) return;
      zone.appendChild(makeCard(c));
    });

    // Update counts + empty states
    COLUMNS.forEach(col => {
      const zoneId  = `cards-${col.id.replace(/\s/g,'-')}`;
      const countId = `count-${col.id.replace(/\s/g,'-')}`;
      const zone    = document.getElementById(zoneId);
      const countEl = document.getElementById(countId);
      const n = zone ? zone.querySelectorAll('.kanban-card').length : 0;
      if (countEl) countEl.textContent = n;
      if (zone && n === 0) {
        const empty = document.createElement('div');
        empty.className = 'kanban-empty';
        empty.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity=".4"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/></svg><span>Aucun prospect</span>`;
        zone.appendChild(empty);
      }
    });
  }

  function makeCard(contact) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = contact.id;

    const isPast = isOverdue(contact.date_relance);
    const relanceStyle = isPast ? 'style="color:#D32F2F;font-weight:bold"' : '';
    const relance = contact.date_relance ? `<div class="kanban-card-row" ${relanceStyle}><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Relance : ${fmtDate(contact.date_relance)}</div>` : '';
    const rating  = contact.google_rating ? `<span class="rating-badge" style="font-size:.625rem">★ ${parseFloat(contact.google_rating).toFixed(1)}</span>` : '';

    card.innerHTML = `
      <div class="kanban-card-name">${escHtml(contact.nom || contact.name || 'Sans nom')}</div>
      <div class="kanban-card-meta">
        <div class="kanban-card-row">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
          ${escHtml(contact.activite || contact.activity || '—')}
        </div>
        <div class="kanban-card-row">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke="currentColor" stroke-width="1.5"/></svg>
          ${escHtml(contact.ville || contact.city || '—')}
        </div>
        ${relance}
      </div>
      <div class="kanban-card-footer">
        <span class="kanban-card-date">${fmtDate(contact.created_at)}</span>
        ${rating}
      </div>
    `;

    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend',   onDragEnd);
    card.addEventListener('click',     () => openContactModal(contact.id));
    return card;
  }

  // ── Stats ─────────────────────────────────────────────────────
  function updateStats() {
    document.getElementById('stat-total').textContent   = allContacts.length;
    document.getElementById('stat-clients').textContent = allContacts.filter(c => (c.statut || c.status) === 'client').length;
    document.getElementById('stat-rdv').textContent     = allContacts.filter(c => (c.statut || c.status) === 'rdv_planifie').length;
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  function onDragStart(e) {
    dragContactId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    placeholder?.remove();
    placeholder = null;
    document.querySelectorAll('.kanban-cards').forEach(z => z.classList.remove('drag-over'));
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const zone = e.currentTarget;
    zone.classList.add('drag-over');
    if (placeholder && !zone.contains(placeholder)) {
      zone.appendChild(placeholder);
    }
  }

  function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
      placeholder?.remove();
    }
  }

  async function onDrop(e) {
    e.preventDefault();
    const zone      = e.currentTarget;
    const newStatus = zone.dataset.status;
    zone.classList.remove('drag-over');
    placeholder?.remove();

    if (!dragContactId || !newStatus) return;

    const contact = allContacts.find(c => c.id === dragContactId);
    if (!contact || (contact.statut || contact.status) === newStatus) return;

    try {
      const extra = {};
      // Logic for email_envoye removed as requested by user
      if (newStatus === 'rdv_planifie' && !contact.date_relance) {
        extra.date_relance = new Date().toISOString().split('T')[0];
      }

      await SupabaseClient.updateContactStatus(token, dragContactId, newStatus, extra);
      contact.statut = newStatus;
      contact.status = newStatus;
      if (extra.date_relance !== undefined) contact.date_relance = extra.date_relance;
      renderBoard();
      updateStats();
      renderOverdue();
      showToast(`${contact.nom || contact.name} → ${newStatus}`, 'success');
    } catch (err) {
      showToast(`Erreur mise à jour : ${err.message}`, 'error');
    }
    dragContactId = null;
  }

  // ── Contact detail modal ──────────────────────────────────────
  function openContactModal(id) {
    currentContact = allContacts.find(c => c.id === id);
    if (!currentContact) return;
    const c = currentContact;

    document.getElementById('contact-modal-name').textContent     = c.nom || c.name || 'Sans nom';
    document.getElementById('contact-modal-activity').textContent = c.activite || c.activity || '—';
    document.getElementById('detail-address').textContent  = [c.adresse || c.address, c.code_postal || c.postal_code, c.ville || c.city].filter(Boolean).join(', ') || '—';
    document.getElementById('detail-email').textContent   = c.email || c['e-mail'] || '—';
    document.getElementById('detail-phone').textContent   = c.telephone || c.phone || '—';

    const websiteEl = document.getElementById('detail-website');
    if (c.website) { websiteEl.href = c.website; websiteEl.textContent = c.website; }
    else           { websiteEl.removeAttribute('href'); websiteEl.textContent = '—'; }

    document.getElementById('detail-rating').textContent  = c.google_rating ? `★ ${parseFloat(c.google_rating).toFixed(1)}` : '—';
    document.getElementById('detail-relance').textContent = c.date_relance ? `Relance : ${fmtDate(c.date_relance)}` : 'Pas de relance planifiée';

    const statusSel = document.getElementById('detail-status-select');
    statusSel.value = c.statut || c.status || 'nouveau_lead';

    const relanceInput = document.getElementById('detail-relance-input');
    if (c.date_relance) {
      // Supabase date is usually ISO string YYYY-MM-DD...
      relanceInput.value = c.date_relance.split('T')[0];
    } else {
      relanceInput.value = '';
    }

    openModal('contact-modal-overlay');
  }

  document.getElementById('contact-modal-close').addEventListener('click', () => closeModal('contact-modal-overlay'));

  document.getElementById('detail-update-status-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    const newStatus = document.getElementById('detail-status-select').value;
    const newRelance = document.getElementById('detail-relance-input').value || null;

    try {
      await SupabaseClient.updateContactStatus(token, currentContact.id, newStatus, { date_relance: newRelance });
      currentContact.statut = newStatus;
      currentContact.status = newStatus;
      currentContact.date_relance = newRelance;
      renderBoard(); updateStats();
      showToast(`Mise à jour réussie`, 'success');
      closeModal('contact-modal-overlay');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  });

  document.getElementById('detail-email-btn').addEventListener('click', () => {
    closeModal('contact-modal-overlay');
    if (currentContact) openEmailModal(currentContact.id);
  });

  document.getElementById('detail-rdv-btn').addEventListener('click', () => {
    closeModal('contact-modal-overlay');
    if (currentContact) openPipelineRdvModal(currentContact.id);
  });

  // ── Email modal (pipeline) ─────────────────────────────────────
  function openEmailModal(contactId) {
    window.location.href = `email-assistant.html?id=${contactId}`;
  }

  document.getElementById('email-modal-close').addEventListener('click', () => closeModal('email-modal-overlay'));

  document.getElementById('generate-email-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    setLoading('generate-email-btn-text', 'generate-spinner', true, 'Génération…');
    document.getElementById('generate-email-btn').disabled = true;
    try {
      const result  = await API.generateEmail(currentContact);
      document.getElementById('email-subject').value = result.subject || result.objet || '';
      document.getElementById('email-body').value    = result.body || result.corps || result.email || '';
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
    if (currentContact) openEmailModal(currentContact.id);
  });

  document.getElementById('validate-send-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    const subject = document.getElementById('email-subject').value.trim();
    const body    = document.getElementById('email-body').value.trim();
    if (!subject || !body) { showToast('Objet et corps requis.', 'error'); return; }
    setLoading('send-btn-text', 'send-spinner', true, 'Envoi…');
    document.getElementById('validate-send-btn').disabled = true;
    try {
      const commercialId = 'lsangouard@gmail.com';
      await API.sendEmail(currentContact.id, commercialId, subject, body);
      const dateRelance = workingDaysFromNow(CONFIG.RELANCE_DAYS);
      await SupabaseClient.updateContactStatus(token, currentContact.id, 'email_envoye', { date_relance: dateRelance });
      currentContact.status = 'email_envoye';
      currentContact.date_relance = dateRelance;
      renderBoard(); updateStats();
      showToast('Email envoyé !', 'success');
      closeModal('email-modal-overlay');
    } catch (err) {
      showToast(`Envoi échoué : ${err.message}`, 'error');
    } finally {
      setLoading('send-btn-text', 'send-spinner', false, 'Valider & Envoyer');
      document.getElementById('validate-send-btn').disabled = false;
    }
  });

  // ── RDV modal (pipeline) ──────────────────────────────────────
  function openPipelineRdvModal(contactId) {
    currentContact = allContacts.find(c => c.id === contactId);
    if (!currentContact) return;
    document.getElementById('rdv-contact-name').textContent = currentContact.nom || currentContact.name || 'Sans nom';
    document.getElementById('rdv-date').value = '';
    document.getElementById('rdv-time').value = '';
    document.getElementById('rdv-time-end').value = '';
    document.getElementById('rdv-location').value = '';
    document.getElementById('rdv-note').value = '';
    openModal('rdv-modal-overlay');
  }

  document.getElementById('rdv-cancel-btn').addEventListener('click', () => closeModal('rdv-modal-overlay'));
  document.getElementById('rdv-modal-close').addEventListener('click', () => closeModal('rdv-modal-overlay'));

  document.getElementById('rdv-confirm-btn').addEventListener('click', async () => {
    if (!currentContact) return;
    const date = document.getElementById('rdv-date').value;
    const time = document.getElementById('rdv-time').value;
    const timeEnd = document.getElementById('rdv-time-end').value;
    const location = document.getElementById('rdv-location').value;
    const commercial = document.getElementById('rdv-commercial').value;
    const note = document.getElementById('rdv-note').value.trim();

    if (!date || !time || !timeEnd) { showToast('Date, début et fin requis.', 'error'); return; }

    const btn = document.getElementById('rdv-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Synchronisation...';

    try {
      const payload = {
        contact_id: currentContact.id,
        date_rdv: date,
        heure_debut: time,
        heure_fin: timeEnd,
        lieu: location,
        lien_visio: location.startsWith('http') ? location : '',
        commercial_id: commercial
      };

      console.log('📡 Envoi au webhook n8n (Kanban):', payload);
      const response = await fetch('https://lsangouard.app.n8n.cloud/webhook/valider-rdv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('✅ Réponse n8n:', result);

      if (result.success) {
        await SupabaseClient.updateContactStatus(token, currentContact.id, 'rdv_planifie', {date_relance: date});
        await SupabaseClient.insertInteraction(token, {
          contact_id: currentContact.id,
          type:       'rdv',
          content:    `RDV Validé (Kanban) : ${date} (${time}-${timeEnd}) - Lieu: ${location}. ${note}`,
        });
        currentContact.statut = 'rdv_planifie';
        currentContact.status = 'rdv_planifie';
        renderBoard(); updateStats();
        showToast('RDV créé et synchronisé !', 'success');
        closeModal('rdv-modal-overlay');
      } else {
        throw new Error(result.message || 'Erreur n8n');
      }
    } catch (err) {
      console.error('🔥 Erreur RDV Kanban:', err);
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmer le RDV';
    }
  });

  // ── Init ──────────────────────────────────────────────────────
  buildBoard();
  await loadContacts();
});

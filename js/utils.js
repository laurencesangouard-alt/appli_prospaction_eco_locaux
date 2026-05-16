/**
 * utils.js — Fonctions utilitaires partagées
 */

// ── Toasts ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v4M8 5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Constantes statut (valeurs réelles en base) ────────────────
const STATUT_DB = {
  NOUVEAU_LEAD:  'nouveau_lead',
  EMAIL_ENVOYE:  'email_envoye',
  A_RELANCER:    'a_relancer',
  RDV_PLANIFIE:  'rdv_planifie',
  CLIENT:        'client',
  EN_ATTENTE:    'en_attente',
  PERDU:         'perdu',
  NE_PAS_RELANCER: 'ne_pas_relancer',
};

const STATUT_LABELS = {
  'nouveau_lead':  'Nouveau lead',
  'email_envoye':  'Email envoyé',
  'a_relancer':    'À relancer',
  'rdv_planifie':  'RDV planifié',
  'client':        'Client',
  'en_attente':    'En attente',
  'perdu':         'Perdu',
  'ne_pas_relancer': 'Ne pas relancer',
};

// ── Status chip ────────────────────────────────────────────────
function statusChip(status) {
  const cssMap = {
    'nouveau_lead':  'nouveau',
    'email_envoye':  'email',
    'a_relancer':    'relancer',
    'rdv_planifie':  'rdv',
    'client':        'client',
    'en_attente':    'attente',
    'perdu':         'perdu',
    'ne_pas_relancer': 'perdu',
  };
  const cls   = cssMap[status] || 'nouveau';
  const label = STATUT_LABELS[status] || status || 'À trier';
  return `<span class="chip chip-${cls}">${escHtml(label)}</span>`;
}

// ── Formatters ─────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function isOverdue(iso) {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(iso);
  // If iso is just YYYY-MM-DD, new Date(iso) might be UTC. 
  // Let's ensure we compare only the date part.
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dDate < today;
}

function fmtRating(val) {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return `★ ${n.toFixed(1)}`;
}

function workingDaysFromNow(days) {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) {
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) {
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// Close buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.modal-close');
  if (btn) {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
});

// ── Alert helpers ──────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  const box = document.getElementById('global-alert');
  const msgEl = document.getElementById('global-alert-msg');
  if (!box || !msgEl) return;
  box.className = `alert alert-${type}`;
  msgEl.textContent = msg;
  box.classList.remove('hidden');
  if (type !== 'error') {
    setTimeout(() => box.classList.add('hidden'), 5000);
  }
}

function hideAlert() {
  const box = document.getElementById('global-alert');
  if (box) box.classList.add('hidden');
}

// ── Loading state on button ────────────────────────────────────
function setLoading(textId, spinnerId, loading, text = '') {
  const textEl    = document.getElementById(textId);
  const spinnerEl = document.getElementById(spinnerId);
  if (textEl && text)  textEl.textContent = text;
  if (spinnerEl) spinnerEl.classList.toggle('hidden', !loading);
}

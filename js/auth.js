/**
 * auth.js — Gestion authentification Supabase
 * Chargé sur toutes les pages
 */
const Auth = (() => {
  const SESSION_KEY = 'prosp_session';

  function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch { return null; }
  }
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getToken() {
    return getSession()?.access_token || null;
  }
  function getUser() {
    return getSession()?.user || null;
  }
  function getUserId() {
    return getUser()?.id || null;
  }
  function getUserMeta() {
    const u = getUser();
    if (!u) return { name: '—', role: '' };
    const name = u.user_metadata?.name || u.email?.split('@')[0] || '—';
    const role = u.user_metadata?.role || '';
    return { name, role };
  }

  // Redirige vers login si pas de session — appelé sur les pages protégées
  function requireAuth() {
    const session = getSession();
    if (!session?.access_token) {
      window.location.href = 'index.html';
      return false;
    }
    // Hydrate les éléments UI communs
    const meta = getUserMeta();
    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    if (avatarEl) avatarEl.textContent = meta.name.charAt(0).toUpperCase();
    if (nameEl)   nameEl.textContent   = meta.name;

    // Bouton logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await SupabaseClient.signOut(getToken()).catch(() => {});
        clearSession();
        window.location.href = 'index.html';
      });
    }

    // Nav scroll shadow
    const nav = document.getElementById('topnav');
    if (nav) {
      window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 4);
      }, { passive: true });
    }

    return true;
  }

  // ── Page Login ────────────────────────────────────────────────
  function initLoginPage() {
    // Si déjà connecté → dashboard
    if (getSession()?.access_token) {
      window.location.href = 'optimisation.html';
      return;
    }

    const form      = document.getElementById('login-form');
    const btnText   = document.getElementById('login-btn-text');
    const spinner   = document.getElementById('login-spinner');
    const alertBox  = document.getElementById('auth-alert');
    const alertMsg  = document.getElementById('auth-alert-msg');
    const togglePwd = document.getElementById('toggle-password');
    const pwdInput  = document.getElementById('password');

    // Toggle password visibility
    if (togglePwd && pwdInput) {
      togglePwd.addEventListener('click', () => {
        const isText = pwdInput.type === 'text';
        pwdInput.type = isText ? 'password' : 'text';
      });
    }

    function showError(msg) {
      alertBox.classList.remove('hidden', 'alert-success', 'bg-green-100', 'text-green-800');
      alertBox.classList.add('alert-error');
      alertMsg.textContent = msg;
      const icon = alertBox.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'error';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      if (!email || !password) { showError('Veuillez remplir tous les champs.'); return; }

      btnText.textContent = 'Connexion…';
      spinner.classList.remove('hidden');
      form.querySelector('button[type=submit]').disabled = true;
      alertBox.classList.add('hidden');

      try {
        const session = await SupabaseClient.signIn(email, password);
        saveSession(session);
        window.location.href = 'optimisation.html';
      } catch (err) {
        showError(err.message || 'Email ou mot de passe incorrect.');
        btnText.textContent = 'Se connecter';
        spinner.classList.add('hidden');
        form.querySelector('button[type=submit]').disabled = false;
      }
    });

    // Mot de passe oublié
    const forgotLink = document.getElementById('forgot-password');
    if (forgotLink) {
      forgotLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        if (!email) {
          showError('Veuillez saisir votre adresse e-mail pour réinitialiser votre mot de passe.');
          document.getElementById('email').focus();
          return;
        }

        if (!confirm(`Envoyer un lien de réinitialisation de mot de passe à ${email} ?`)) return;

        btnText.textContent = 'Envoi…';
        spinner.classList.remove('hidden');
        alertBox.classList.add('hidden');

        try {
          await SupabaseClient.resetPasswordForEmail(email);
          alertBox.classList.remove('hidden', 'alert-error');
          alertBox.classList.add('alert-success', 'bg-green-100', 'text-green-800');
          alertMsg.textContent = 'Un lien de réinitialisation a été envoyé à votre adresse e-mail.';
          const icon = alertBox.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = 'check_circle';
        } catch (err) {
          showError(err.message || 'Une erreur est survenue.');
        } finally {
          btnText.textContent = 'Se connecter';
          spinner.classList.add('hidden');
        }
      });
    }
  }

  return { saveSession, getSession, clearSession, getToken, getUser, getUserId, getUserMeta, requireAuth, initLoginPage };
})();

// ── Auto-init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const isLogin = document.body.classList.contains('login-page');
  if (isLogin) {
    Auth.initLoginPage();
  }
});

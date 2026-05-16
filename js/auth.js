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
    // ── Interception du lien magique Supabase ──────────────────
    // Supabase redirige vers index.html#access_token=...&type=magiclink
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type         = params.get('type'); // 'magiclink', 'recovery', 'signup'

      if (accessToken) {
        // Nettoyer le hash de l'URL
        history.replaceState(null, '', window.location.pathname);

        if (type === 'recovery') {
          // Mode réinitialisation de mot de passe
          const form = document.getElementById('login-form');
          const title = document.querySelector('h1');
          const submitBtn = form.querySelector('button[type="submit"]');
          const emailGroup = document.getElementById('email').closest('.space-y-2');
          
          if (title) title.textContent = 'Nouveau mot de passe';
          if (emailGroup) emailGroup.classList.add('hidden');
          if (submitBtn) submitBtn.querySelector('#login-btn-text').textContent = 'Mettre à jour le mot de passe';
          
          // Changer l'action du formulaire
          form.onsubmit = async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('password').value;
            try {
              const success = await SupabaseClient.updatePassword(accessToken, newPassword);
              if (success) {
                alert('Mot de passe mis à jour ! Connectez-vous avec votre nouveau mot de passe.');
                window.location.reload();
              }
            } catch (err) {
              alert('Erreur : ' + err.message);
            }
          };
          return;
        }

        // Mode Magic Link (existant)
        SupabaseClient.getUser(accessToken).then(user => {
          if (user) {
            saveSession({ access_token: accessToken, refresh_token: refreshToken, user });
            window.location.href = 'optimisation.html';
          } else {
            // Afficher un message d'erreur si le token est invalide
            const alertBox = document.getElementById('auth-alert');
            const alertMsg = document.getElementById('auth-alert-msg');
            if (alertBox && alertMsg) {
              alertBox.classList.remove('hidden', 'alert-success');
              alertBox.classList.add('alert-error');
              alertMsg.textContent = 'Lien expiré ou invalide. Demandez un nouveau lien magique.';
            }
          }
        }).catch(() => {
          const alertBox = document.getElementById('auth-alert');
          const alertMsg = document.getElementById('auth-alert-msg');
          if (alertBox && alertMsg) {
            alertBox.classList.remove('hidden', 'alert-success');
            alertBox.classList.add('alert-error');
            alertMsg.textContent = 'Erreur lors de la vérification du lien. Réessayez.';
          }
        });
        return; // Attendre la vérification du token, ne pas continuer
      }
    }

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
      forgotLink.onclick = async (e) => {
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
      };
    }

    // Lien magique (OTP)
    const magicBtn = document.getElementById('magic-link-btn');
    if (magicBtn) {
      magicBtn.onclick = async () => {
        const email = document.getElementById('email').value.trim();
        if (!email) {
          showError('Saisissez votre e-mail pour recevoir un lien magique.');
          document.getElementById('email').focus();
          return;
        }

        magicBtn.disabled = true;
        magicBtn.textContent = 'Envoi…';
        alertBox.classList.add('hidden');

        try {
          await SupabaseClient.signInWithOtp(email);
          alertBox.classList.remove('hidden', 'alert-error');
          alertBox.classList.add('alert-success', 'bg-green-100', 'text-green-800');
          alertMsg.textContent = 'Un lien de connexion a été envoyé par e-mail !';
          const icon = alertBox.querySelector('.material-symbols-outlined');
          if (icon) icon.textContent = 'magic_button';
        } catch (err) {
          showError(err.message || 'Erreur lors de l\'envoi du lien magique.');
        } finally {
          magicBtn.disabled = false;
          magicBtn.innerHTML = '<span class="material-symbols-outlined text-lg">magic_button</span> Lien magique';
        }
      };
    }

    const testBtn = document.getElementById('test-mode-btn');
    if (testBtn) {
      testBtn.onclick = () => {
        const email = document.getElementById('email').value.trim() || 'test@ecolocaux.fr';
        const name = email.split('@')[0];
        
        // Utilise la clé anon Supabase pour accéder aux vraies données (rôle anon)
        const mockSession = {
          access_token: CONFIG.SUPABASE_ANON,
          user: {
            id: 'test-anon-user',
            email: email,
            user_metadata: { name: name, role: 'test_user' }
          }
        };
        
        saveSession(mockSession);
        alertBox.classList.remove('hidden', 'alert-error');
        alertBox.classList.add('alert-success', 'bg-blue-100', 'text-blue-800');
        alertMsg.textContent = 'Connexion mode test réussie ! Redirection...';
        
        setTimeout(() => {
          window.location.href = 'optimisation.html';
        }, 800);
      };
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

/**
 * nav.js — Navigation commune + gestion auth pour les pages Stitch
 */
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // Vérifie auth
    const session = Auth.getSession();
    if (!session?.access_token) {
      window.location.href = 'index.html';
      return;
    }

    const meta = Auth.getUserMeta();

    // Hydrate user name/avatar dans la nav
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = meta.name;
    });
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      el.textContent = meta.name.charAt(0).toUpperCase();
    });

    // Logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SupabaseClient.signOut(Auth.getToken()).catch(() => {});
        Auth.clearSession();
        window.location.href = 'index.html';
      });
    });
  });
})();

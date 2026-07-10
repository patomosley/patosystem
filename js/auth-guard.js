/**
 * PATO SO - Auth Guard
 * Protege as páginas do sistema exigindo login via Supabase Auth.
 * Inclua este script (junto com o supabase-js) no <head> de toda página
 * que deve ficar restrita a usuários logados.
 *
 * IMPORTANTE: preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo com os
 * dados do seu projeto Supabase (Project Settings > API).
 */

const SUPABASE_URL = "https://vzkrozimewevbfcpcfgu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KA_AJdsFhfP4gIkOflQUmg_qCULQst8";

(function () {
  function init() {
    if (!window.supabase) {
      // aguarda o script do supabase-js (carregado via CDN) terminar de carregar
      setTimeout(init, 30);
      return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = client;

    client.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        redirectToLogin();
        return;
      }
      revealPage();
      injectLogoutBadge(client, session.user.email);
    }).catch(() => {
      redirectToLogin();
    });

    // se o usuário deslogar em outra aba, expulsa daqui também
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        redirectToLogin();
      }
    });
  }

  function redirectToLogin() {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/login.html?next=" + next;
  }

  function revealPage() {
    document.documentElement.style.visibility = "visible";
  }

  function injectLogoutBadge(client, email) {
    const style = document.createElement("style");
    style.textContent = `
      #pato-auth-badge {
        position: fixed;
        bottom: 14px;
        right: 14px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        color: #333333;
        border: 1px solid #e0e0e0;
        border-radius: 999px;
        padding: 6px 10px 6px 14px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      }
      #pato-auth-badge span {
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #pato-auth-badge button {
        background: #ff7700;
        color: #fff;
        border: none;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      #pato-auth-badge button:hover { background: #ff9933; }
    `;
    document.head.appendChild(style);

    const badge = document.createElement("div");
    badge.id = "pato-auth-badge";
    badge.innerHTML = `<span title="${email}">${email}</span><button type="button">Sair</button>`;
    badge.querySelector("button").addEventListener("click", async () => {
      await client.auth.signOut();
      location.href = "/login.html";
    });
    document.body.appendChild(badge);
  }

  init();
})();

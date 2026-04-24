/* ============================================================
   Supabase 共通クライアント初期化 + 認証ユーティリティ
   すべての認証関連ページから読み込む前提。
   依存: Supabase JS (CDN) を事前に <script> で読み込むこと。
============================================================ */
(function () {
  "use strict";

  window.AuthApp = {
    client: null,
    config: null,
    ready: null
  };

  window.AuthApp.ready = (async () => {
    try {
      const r = await fetch("/api/config");
      const cfg = await r.json();
      window.AuthApp.config = cfg;
      const url = cfg?.supabase?.url;
      const key = cfg?.supabase?.anonKey;
      if (url && key && window.supabase && typeof window.supabase.createClient === "function") {
        window.AuthApp.client = window.supabase.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
      }
    } catch (e) {
      console.error("AuthApp init failed:", e);
    }
  })();

  window.AuthApp.getUser = async function () {
    await window.AuthApp.ready;
    if (!window.AuthApp.client) return null;
    const { data } = await window.AuthApp.client.auth.getUser();
    return data?.user || null;
  };

  window.AuthApp.signOut = async function () {
    await window.AuthApp.ready;
    if (!window.AuthApp.client) return;
    await window.AuthApp.client.auth.signOut();
  };

  window.AuthApp.requireReady = async function () {
    await window.AuthApp.ready;
    if (!window.AuthApp.client) {
      throw new Error("認証機能が未設定です（サーバーの環境変数 SUPABASE_URL / SUPABASE_ANON_KEY を確認してください）");
    }
    return window.AuthApp.client;
  };

  // 共通 CSS トークン + レスポンシブ
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --bg: #f5f5f7; --panel: #ffffff; --text: #1d1d1f; --muted: #6e6e73;
      --border: #d2d2d7; --accent: #0071e3; --accent-hover: #0077ed;
      --correct: #34c759; --wrong: #ff3b30; --warning: #ff9500;
      --shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", "Yu Gothic", sans-serif;
      background: var(--bg); color: var(--text); line-height: 1.6;
      -webkit-text-size-adjust: 100%;
    }
    .container { max-width: 520px; margin: 0 auto; padding: 28px 16px 48px; }
    .wide { max-width: 1100px; }
    h1 { font-size: 22px; margin: 0 0 14px; }
    h2 { font-size: 17px; margin: 0 0 12px; }
    .panel { background: var(--panel); border-radius: 12px; padding: 20px; box-shadow: var(--shadow); margin-bottom: 16px; }
    label { display: block; font-size: 13px; margin-bottom: 6px; color: var(--muted); }
    /* iOSズームを防ぐため入力は16px以上 */
    input[type="text"], input[type="email"], input[type="password"], select, textarea {
      width: 100%; padding: 12px 14px; border: 1px solid var(--border);
      border-radius: 8px; font-size: 16px; background: #fff; font-family: inherit;
      -webkit-appearance: none; appearance: none;
    }
    select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236e6e73' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
    .field { margin-bottom: 14px; }
    button, .btn {
      background: var(--accent); color: white; border: none;
      padding: 12px 22px; border-radius: 8px; font-size: 15px;
      cursor: pointer; font-family: inherit; transition: background 0.15s;
      min-height: 44px; /* touch target */
    }
    button:hover:not(:disabled) { background: var(--accent-hover); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button.secondary { background: transparent; color: var(--accent); border: 1px solid var(--border); }
    button.danger { background: var(--wrong); }
    .link { color: var(--accent); text-decoration: underline; cursor: pointer; }
    .muted { color: var(--muted); font-size: 13px; }
    .error { background: #fff2f2; color: var(--wrong); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .notice { background: #e8f2ff; color: var(--accent); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .ok { background: #e8f9ee; color: var(--correct); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .consent-row { display: flex; gap: 10px; align-items: flex-start; padding: 12px 0; font-size: 14px; }
    .consent-row input[type="checkbox"] { margin-top: 4px; flex-shrink: 0; width: 20px; height: 20px; }
    .consent-row label { font-size: 14px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { background: #f5f5f7; font-weight: 600; position: sticky; top: 0; }
    .table-wrap { overflow-x: auto; max-height: 70vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; }
    .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }

    /* モバイル */
    @media (max-width: 640px) {
      .container { padding: 18px 12px 48px; }
      h1 { font-size: 20px; }
      h2 { font-size: 16px; }
      .panel { padding: 16px; border-radius: 10px; }
      .row { gap: 10px; }
      .row > * { width: 100%; }
      .row > button, .row > .btn { width: 100%; }
      .row > a.link { text-align: center; width: 100%; }
      button, .btn { width: 100%; font-size: 15px; }
      button.inline { width: auto; }
      .consent-row { font-size: 14px; }
      .hint { font-size: 12px; }
    }
    @media (min-width: 641px) {
      .row > a.link { width: auto; }
    }
  `;
  document.head.appendChild(style);
})();

/* ============================================================
   Offline auth/profile/history helpers.
   No network calls, no CDN, no external service. Everything stays
   in this browser's localStorage.
============================================================ */
(function () {
  "use strict";

  const KEYS = {
    users: "webtest_offline_users_v1",
    session: "webtest_offline_session_v1",
    results: "webtest_offline_results_v1",
    surveys: "webtest_offline_surveys_v1",
    consents: "webtest_offline_consents_v1"
  };

  const nowIso = () => new Date().toISOString();
  const uuid = () =>
    crypto?.randomUUID?.() ||
    `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  function getUsers() {
    return readJson(KEYS.users, []);
  }

  function saveUsers(users) {
    writeJson(KEYS.users, users);
  }

  function getSession() {
    return readJson(KEYS.session, null);
  }

  function setSession(session) {
    writeJson(KEYS.session, session);
  }

  async function currentUser() {
    const session = getSession();
    if (!session?.userId) return null;
    const user = getUsers().find(u => u.id === session.userId);
    return publicUser(user);
  }

  window.AuthApp = {
    config: { offline: true },
    ready: Promise.resolve(),
    client: { offline: true },

    async register(profile) {
      const email = String(profile.email || "").trim().toLowerCase();
      const password = String(profile.password || "");
      if (!email) throw new Error("メールアドレスを入力してください");
      if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");
      const users = getUsers();
      if (users.some(u => u.email === email)) {
        throw new Error("このメールアドレスは既に登録されています");
      }
      const user = {
        id: uuid(),
        email,
        passwordHash: await sha256(password),
        nickname: String(profile.nickname || "").trim(),
        university: String(profile.university || "").trim(),
        graduation_year: String(profile.graduation_year || "").trim(),
        first_choice_industry: profile.first_choice_industry || null,
        is_admin: false,
        created_at: nowIso(),
        last_sign_in_at: nowIso()
      };
      users.push(user);
      saveUsers(users);
      writeJson(KEYS.consents, readJson(KEYS.consents, []).concat({
        id: uuid(),
        user_id: user.id,
        consent_type: "terms_privacy",
        agreed: !!profile.consent_terms,
        agreed_at: nowIso(),
        user_agent: navigator.userAgent.slice(0, 300)
      }));
      setSession({ userId: user.id, signedInAt: nowIso() });
      return publicUser(user);
    },

    async signIn(email, password) {
      const normalized = String(email || "").trim().toLowerCase();
      const passwordHash = await sha256(String(password || ""));
      const users = getUsers();
      const idx = users.findIndex(u => u.email === normalized && u.passwordHash === passwordHash);
      if (idx < 0) throw new Error("メールアドレスまたはパスワードが違います");
      users[idx].last_sign_in_at = nowIso();
      saveUsers(users);
      setSession({ userId: users[idx].id, signedInAt: nowIso() });
      return publicUser(users[idx]);
    },

    async getUser() {
      return currentUser();
    },

    async getProfile() {
      return currentUser();
    },

    async signOut() {
      localStorage.removeItem(KEYS.session);
    },

    saveAttempt(attempt) {
      const rows = readJson(KEYS.results, []);
      rows.push({ id: uuid(), saved_at: nowIso(), ...attempt });
      writeJson(KEYS.results, rows);
    },

    saveSurvey(survey) {
      const rows = readJson(KEYS.surveys, []);
      rows.push({ id: uuid(), submitted_at: nowIso(), ...survey });
      writeJson(KEYS.surveys, rows);
    },

    exportLocalData() {
      return {
        users: getUsers().map(publicUser),
        session: getSession(),
        results: readJson(KEYS.results, []),
        surveys: readJson(KEYS.surveys, []),
        consents: readJson(KEYS.consents, [])
      };
    },

    clearLocalData() {
      Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    }
  };

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
    input[type="text"], input[type="email"], input[type="password"], select, textarea {
      width: 100%; padding: 12px 14px; border: 1px solid var(--border);
      border-radius: 8px; font-size: 16px; background: #fff; font-family: inherit;
      -webkit-appearance: none; appearance: none;
    }
    select { padding-right: 36px; }
    .field { margin-bottom: 14px; }
    button, .btn {
      background: var(--accent); color: white; border: none;
      padding: 12px 22px; border-radius: 8px; font-size: 15px;
      cursor: pointer; font-family: inherit; transition: background 0.15s;
      min-height: 44px;
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

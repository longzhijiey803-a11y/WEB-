// server.js — 静的配信 + Supabase連携 + 管理画面（堅牢化）
//
// 環境変数:
//   SUPABASE_URL                    Supabase プロジェクト URL
//   SUPABASE_ANON_KEY               フロントエンドに渡す公開キー
//   SUPABASE_SERVICE_ROLE_KEY       🔴 サーバ専用・秘匿
//   ADMIN_PASSWORD                  管理画面ログイン用 (十分に長くランダムな文字列を)
//   PORT                            (任意) デフォルト 10000

import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// ---------- 管理セッション（メモリ保持・サーバ再起動で失効） ----------
const adminSessions = new Map();           // token -> expiresAt (ms epoch)
const SESSION_TTL_MS = 60 * 60 * 1000;     // 1 hour
function newAdminSession() {
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}
function isValidAdminSession(token) {
  if (!token) return false;
  const exp = adminSessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { adminSessions.delete(token); return false; }
  return true;
}
// 期限切れセッション定期掃除
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of adminSessions) if (now > exp) adminSessions.delete(k);
}, 10 * 60 * 1000).unref?.();

// ---------- レート制限（admin ログイン試行） ----------
const loginAttempts = new Map();           // ip -> number[] (timestamps)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
function recordAndCheck(ip) {
  const now = Date.now();
  const arr = (loginAttempts.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  loginAttempts.set(ip, arr);
  return arr.length <= MAX_ATTEMPTS;
}

function getIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || "unknown";
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach(c => {
    const idx = c.indexOf("=");
    if (idx < 0) return;
    const k = c.slice(0, idx).trim();
    const v = decodeURIComponent(c.slice(idx + 1).trim());
    if (k) out[k] = v;
  });
  return out;
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ---------- セキュリティヘッダ (全レスポンス) ----------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  // HTTPS 時は HSTS を追加
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // CSP (Supabase と CDN (jsdelivr) を許可)
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );
  next();
});

// ---------- アクセスログ（統計用 / メモリ保持） ----------
const ACCESS_LOG_MAX = 20000;
const accessLog = []; // [{ts, ip, path}]
app.use((req, _res, next) => {
  // 管理系・API・静的アセットは統計対象外
  const p = req.path;
  const isPage = req.method === "GET" && (p === "/" || /\.html?$/.test(p) || p === "/signup" || p === "/login" || p === "/privacy" || p === "/terms");
  if (isPage) {
    accessLog.push({
      ts: Date.now(),
      ip: getIp(req),
      path: p,
      ua: (req.headers["user-agent"] || "").slice(0, 300),
      referer: (req.headers["referer"] || req.headers["referrer"] || "").slice(0, 300)
    });
    if (accessLog.length > ACCESS_LOG_MAX) accessLog.splice(0, accessLog.length - ACCESS_LOG_MAX);
  }
  next();
});

// ---------- 管理ルート（静的配信より前に定義） ----------

// ログインページ（URL を知らない限り到達しない設計）
app.get("/admin-login", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.sendFile(path.join(__dirname, "private", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "admin not configured on server" });
  const ip = getIp(req);
  if (!recordAndCheck(ip)) {
    return res.status(429).json({ error: "too many attempts. wait 15 minutes." });
  }
  const { password } = req.body || {};
  if (typeof password !== "string" || !safeEqual(password, ADMIN_PASSWORD)) {
    console.log(JSON.stringify({ event: "admin_login_fail", ip, t: new Date().toISOString() }));
    // タイミング一定化のための意図的な遅延
    return setTimeout(() => res.status(401).json({ error: "invalid password" }), 250 + Math.random() * 250);
  }
  const token = newAdminSession();
  const secure = (req.secure || req.headers["x-forwarded-proto"] === "https") ? "Secure; " : "";
  res.setHeader("Set-Cookie",
    `admin_session=${token}; HttpOnly; ${secure}SameSite=Strict; Path=/admin; Max-Age=${SESSION_TTL_MS / 1000}`
  );
  console.log(JSON.stringify({ event: "admin_login_success", ip, t: new Date().toISOString() }));
  res.json({ ok: true });
});

app.post("/admin/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.admin_session) adminSessions.delete(cookies.admin_session);
  const secure = (req.secure || req.headers["x-forwarded-proto"] === "https") ? "Secure; " : "";
  res.setHeader("Set-Cookie",
    `admin_session=; HttpOnly; ${secure}SameSite=Strict; Path=/admin; Max-Age=0`
  );
  res.json({ ok: true });
});

// Supabase JWT を検証して、is_admin=true なら admin セッション発行（SSO ログイン）
app.post("/admin/login-sso", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "supabase not configured" });
  }
  const ip = getIp(req);
  if (!recordAndCheck(ip)) {
    return res.status(429).json({ error: "too many attempts. wait 15 minutes." });
  }
  const { access_token } = req.body || {};
  if (!access_token || typeof access_token !== "string") {
    return res.status(400).json({ error: "missing access_token" });
  }
  try {
    // JWT 検証: Supabase に問い合わせ
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${access_token}` }
    });
    if (!userRes.ok) {
      console.log(JSON.stringify({ event: "admin_sso_invalid_jwt", ip, t: new Date().toISOString() }));
      return res.status(401).json({ error: "invalid token" });
    }
    const user = await userRes.json();
    if (!user?.id) return res.status(401).json({ error: "no user" });

    // is_admin チェック（service_role で profiles 読み取り）
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: "server not configured" });
    }
    const profRes = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin,nickname`);
    if (!profRes.ok) return res.status(500).json({ error: "profile check failed" });
    const profiles = await profRes.json();
    if (!profiles[0] || !profiles[0].is_admin) {
      console.log(JSON.stringify({ event: "admin_sso_denied", ip, user_id: user.id, t: new Date().toISOString() }));
      return res.status(403).json({ error: "not an admin" });
    }

    // 管理セッションクッキー発行
    const token = newAdminSession();
    const secure = (req.secure || req.headers["x-forwarded-proto"] === "https") ? "Secure; " : "";
    res.setHeader("Set-Cookie",
      `admin_session=${token}; HttpOnly; ${secure}SameSite=Strict; Path=/admin; Max-Age=${SESSION_TTL_MS / 1000}`
    );
    console.log(JSON.stringify({ event: "admin_sso_success", ip, user_id: user.id, nickname: profiles[0].nickname, t: new Date().toISOString() }));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ログイン中ユーザーが admin かどうかを確認するエンドポイント（フロント用）
app.get("/api/is-admin", async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.json({ isAdmin: false });
  }
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return res.json({ isAdmin: false });
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${m[1]}` }
    });
    if (!userRes.ok) return res.json({ isAdmin: false });
    const user = await userRes.json();
    if (!user?.id) return res.json({ isAdmin: false });
    const profRes = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`);
    if (!profRes.ok) return res.json({ isAdmin: false });
    const profiles = await profRes.json();
    res.json({ isAdmin: !!profiles[0]?.is_admin });
  } catch {
    res.json({ isAdmin: false });
  }
});

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  if (!isValidAdminSession(cookies.admin_session)) {
    // HTML を期待するリクエストはログインページへ、その他は 401 JSON
    if (req.accepts("html") && !req.path.startsWith("/admin/api/")) {
      return res.redirect("/admin-login");
    }
    return res.status(401).json({ error: "unauthorized" });
  }
  // 各レスポンスにも noindex を念の為付与
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}

// 管理 HTML（認証後のみ配信）
app.get("/admin", requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

// ---------- 管理 API ----------
function requireSupabaseService(res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: "Supabase not configured" });
    return false;
  }
  return true;
}
function supabaseFetch(pathAndQuery, init = {}) {
  return fetch(`${SUPABASE_URL}${pathAndQuery}`, {
    ...init,
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Accept": "application/json",
      ...(init.headers || {})
    }
  });
}

app.get("/admin/api/users", requireAdmin, async (_req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    const [authRes, profRes] = await Promise.all([
      supabaseFetch(`/auth/v1/admin/users?per_page=1000`),
      supabaseFetch(`/rest/v1/profiles?select=*`)
    ]);
    if (!authRes.ok) {
      const t = await authRes.text();
      return res.status(500).json({ error: "auth admin fetch failed", detail: t.slice(0, 200) });
    }
    const profiles = profRes.ok ? await profRes.json() : [];
    const authData = await authRes.json();
    const users = (authData.users || []).map(u => {
      const p = profiles.find(pr => pr.id === u.id) || {};
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        nickname: p.nickname || null,
        university: p.university || null,
        graduation_year: p.graduation_year || null,
        first_choice_industry: p.first_choice_industry || null
      };
    });
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ users, total: users.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/admin/api/consents", requireAdmin, async (_req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    const r = await supabaseFetch(`/rest/v1/consent_logs?select=*&order=agreed_at.desc&limit=500`);
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: "consents fetch failed", detail: t.slice(0, 200) });
    }
    const logs = await r.json();
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete("/admin/api/users/:id", requireAdmin, async (req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    const r = await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(req.params.id)}`, { method: "DELETE" });
    if (!r.ok) return res.status(500).json({ error: "delete failed" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// テスト結果一覧（ユーザー情報 JOIN）
app.get("/admin/api/results", requireAdmin, async (_req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    const [resultsRes, authRes, profRes] = await Promise.all([
      supabaseFetch(`/rest/v1/test_results?select=*&order=completed_at.desc&limit=1000`),
      supabaseFetch(`/auth/v1/admin/users?per_page=1000`),
      supabaseFetch(`/rest/v1/profiles?select=*`)
    ]);
    if (!resultsRes.ok) {
      const t = await resultsRes.text();
      return res.status(500).json({ error: "results fetch failed", detail: t.slice(0, 200) });
    }
    const results = await resultsRes.json();
    const authData = authRes.ok ? await authRes.json() : { users: [] };
    const profiles = profRes.ok ? await profRes.json() : [];

    const byId = new Map();
    for (const u of authData.users || []) byId.set(u.id, { email: u.email });
    for (const p of profiles) {
      const prev = byId.get(p.id) || {};
      byId.set(p.id, { ...prev, nickname: p.nickname, university: p.university });
    }
    const enriched = results.map(r => {
      const info = byId.get(r.user_id) || {};
      const accuracy = r.total > 0 ? Math.round((r.score / r.total) * 1000) / 10 : 0;
      return { ...r, email: info.email || null, nickname: info.nickname || null, university: info.university || null, accuracy };
    });

    // モード別サマリ
    const modeStats = {};
    for (const r of enriched) {
      const m = r.mode || "unknown";
      if (!modeStats[m]) modeStats[m] = { count: 0, totalScore: 0, totalQs: 0, totalDurationSec: 0 };
      modeStats[m].count++;
      modeStats[m].totalScore += r.score || 0;
      modeStats[m].totalQs += r.total || 0;
      modeStats[m].totalDurationSec += r.duration_sec || 0;
    }
    const summaryByMode = Object.entries(modeStats).map(([mode, s]) => ({
      mode,
      attempts: s.count,
      avgAccuracy: s.totalQs > 0 ? Math.round((s.totalScore / s.totalQs) * 1000) / 10 : 0,
      avgDurationSec: s.count > 0 ? Math.round(s.totalDurationSec / s.count) : 0
    }));

    res.json({ results: enriched, summaryByMode, total: enriched.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 単一ユーザー詳細（全データ深掘り）
app.get("/admin/api/user/:id", requireAdmin, async (req, res) => {
  if (!requireSupabaseService(res)) return;
  const id = req.params.id;
  try {
    const [userRes, profRes, resultsRes, answersRes, consentRes] = await Promise.all([
      supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`),
      supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=*`),
      supabaseFetch(`/rest/v1/test_results?user_id=eq.${encodeURIComponent(id)}&select=*&order=completed_at.desc`),
      supabaseFetch(`/rest/v1/test_answers?user_id=eq.${encodeURIComponent(id)}&select=*&order=answered_at.desc&limit=2000`),
      supabaseFetch(`/rest/v1/consent_logs?user_id=eq.${encodeURIComponent(id)}&select=*&order=agreed_at.desc`)
    ]);
    const user = userRes.ok ? await userRes.json() : null;
    const profile = profRes.ok ? (await profRes.json())[0] || null : null;
    const results = resultsRes.ok ? await resultsRes.json() : [];
    const answers = answersRes.ok ? await answersRes.json() : [];
    const consents = consentRes.ok ? await consentRes.json() : [];

    // モード別パフォーマンス
    const perMode = {};
    for (const r of results) {
      if (!perMode[r.mode]) perMode[r.mode] = { attempts: 0, totalScore: 0, totalQs: 0, totalDurationSec: 0 };
      perMode[r.mode].attempts++;
      perMode[r.mode].totalScore += r.score || 0;
      perMode[r.mode].totalQs += r.total || 0;
      perMode[r.mode].totalDurationSec += r.duration_sec || 0;
    }
    const modeSummary = Object.entries(perMode).map(([m, s]) => ({
      mode: m, attempts: s.attempts,
      avgAccuracy: s.totalQs > 0 ? Math.round((s.totalScore / s.totalQs) * 1000) / 10 : 0,
      avgDurationSec: s.attempts > 0 ? Math.round(s.totalDurationSec / s.attempts) : 0
    }));

    res.json({ user, profile, results, answers, consents, modeSummary });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// デバイス内訳 (User-Agent を簡易パース)
app.get("/admin/api/devices", requireAdmin, async (_req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    // consent_logs と accessLog 両方から UA を集める
    const consentRes = await supabaseFetch(`/rest/v1/consent_logs?select=user_agent&limit=1000`);
    const consentUAs = consentRes.ok ? (await consentRes.json()).map(x => x.user_agent).filter(Boolean) : [];
    const allUAs = consentUAs.concat(accessLog.map(e => e.ua).filter(Boolean));

    const buckets = { device: {}, os: {}, browser: {} };
    for (const ua of allUAs) {
      const d = parseUA(ua);
      buckets.device[d.device] = (buckets.device[d.device] || 0) + 1;
      buckets.os[d.os] = (buckets.os[d.os] || 0) + 1;
      buckets.browser[d.browser] = (buckets.browser[d.browser] || 0) + 1;
    }
    // referrer 集計
    const refs = {};
    for (const e of accessLog) {
      if (!e.referer) continue;
      try {
        const host = new URL(e.referer).hostname || "(不明)";
        refs[host] = (refs[host] || 0) + 1;
      } catch { refs["(不明)"] = (refs["(不明)"] || 0) + 1; }
    }
    res.json({
      total: allUAs.length,
      device: buckets.device, os: buckets.os, browser: buckets.browser,
      referrers: refs
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// UA 簡易パーサ
function parseUA(ua) {
  const s = ua || "";
  let device = "デスクトップ", os = "不明", browser = "不明";
  if (/iPhone|iPod/.test(s)) { device = "モバイル"; os = "iOS"; }
  else if (/iPad/.test(s)) { device = "タブレット"; os = "iPadOS"; }
  else if (/Android/.test(s)) {
    device = /Mobile/.test(s) ? "モバイル" : "タブレット";
    os = "Android";
  }
  else if (/Windows/.test(s)) os = "Windows";
  else if (/Macintosh|Mac OS X/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";

  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\//.test(s)) browser = "Opera";
  else if (/Chrome\//.test(s) && !/Edg\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s) && !/Chrome\//.test(s)) browser = "Safari";
  else if (/Firefox\//.test(s)) browser = "Firefox";

  return { device, os, browser };
}

// 問題別統計（どの問題の正答率が低いか）
app.get("/admin/api/question-stats", requireAdmin, async (_req, res) => {
  if (!requireSupabaseService(res)) return;
  try {
    const r = await supabaseFetch(`/rest/v1/test_answers?select=mode,section_index,question_index,is_correct,time_spent_sec&limit=5000`);
    if (!r.ok) return res.status(500).json({ error: "answers fetch failed" });
    const answers = await r.json();
    const groups = {};
    for (const a of answers) {
      const key = `${a.mode}|${a.section_index}|${a.question_index}`;
      if (!groups[key]) groups[key] = { mode: a.mode, section_index: a.section_index, question_index: a.question_index, correct: 0, total: 0, totalTime: 0 };
      groups[key].total++;
      if (a.is_correct) groups[key].correct++;
      if (a.time_spent_sec) groups[key].totalTime += a.time_spent_sec;
    }
    const questions = Object.values(groups).map(g => ({
      ...g,
      accuracy: g.total > 0 ? Math.round((g.correct / g.total) * 1000) / 10 : 0,
      avgTimeSec: g.total > 0 ? Math.round(g.totalTime / g.total) : 0
    })).sort((a, b) => a.accuracy - b.accuracy);
    res.json({ questions, total: questions.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// 統計（アクセス数・アクティブユーザー）
app.get("/admin/api/stats", requireAdmin, async (_req, res) => {
  const now = Date.now();
  const HOUR = 3600_000;
  const DAY = 24 * HOUR;
  const recent24h = accessLog.filter(e => now - e.ts < DAY);
  const recent7d  = accessLog.filter(e => now - e.ts < 7 * DAY);
  const recent1h  = accessLog.filter(e => now - e.ts < HOUR);
  const uniqueIps = (arr) => new Set(arr.map(e => e.ip)).size;

  // 時間別アクセス推移（直近24h、1時間刻み）
  const hourlyBuckets = new Array(24).fill(0);
  for (const e of accessLog) {
    const diff = now - e.ts;
    if (diff < DAY) {
      const bucket = 23 - Math.floor(diff / HOUR);
      if (bucket >= 0 && bucket < 24) hourlyBuckets[bucket]++;
    }
  }

  // アクティブユーザー（Supabase から last_sign_in_at を集計）
  let activeUsers = { active1h: 0, active24h: 0, active7d: 0, registeredTotal: 0 };
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const r = await supabaseFetch(`/auth/v1/admin/users?per_page=1000`);
      if (r.ok) {
        const d = await r.json();
        const users = d.users || [];
        const signedAt = (u) => u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
        activeUsers = {
          registeredTotal: users.length,
          active1h: users.filter(u => now - signedAt(u) < HOUR && signedAt(u) > 0).length,
          active24h: users.filter(u => now - signedAt(u) < DAY && signedAt(u) > 0).length,
          active7d: users.filter(u => now - signedAt(u) < 7 * DAY && signedAt(u) > 0).length
        };
      }
    } catch (e) { /* ignore */ }
  }

  res.json({
    visits: {
      total: accessLog.length,
      last1h: recent1h.length,
      last24h: recent24h.length,
      last7d: recent7d.length
    },
    uniqueIPs: {
      total: uniqueIps(accessLog),
      last1h: uniqueIps(recent1h),
      last24h: uniqueIps(recent24h),
      last7d: uniqueIps(recent7d)
    },
    hourly24h: hourlyBuckets, // 長さ24、最古→最新
    activeUsers,
    serverStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString()
  });
});

// ---------- 公開設定 ----------
app.get("/api/config", (_req, res) => {
  res.json({
    supabase: { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY },
    featuresEnabled: { auth: !!(SUPABASE_URL && SUPABASE_ANON_KEY) }
  });
});

// ---------- 静的配信（public のみ。admin.html は private/ にあるため露出しない） ----------
app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: "startup",
    port: PORT,
    supabaseConfigured: !!SUPABASE_URL,
    supabaseServiceConfigured: !!SUPABASE_SERVICE_ROLE_KEY,
    adminConfigured: !!ADMIN_PASSWORD
  }));
});

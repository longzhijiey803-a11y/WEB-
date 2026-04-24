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
app.use(express.json({ limit: "1mb" }));

// ---------- アクセスログ（統計用 / メモリ保持） ----------
const ACCESS_LOG_MAX = 20000;
const accessLog = []; // [{ts, ip, path}]
app.use((req, _res, next) => {
  // 管理系・API・静的アセットは統計対象外
  const p = req.path;
  const isPage = req.method === "GET" && (p === "/" || /\.html?$/.test(p) || p === "/signup" || p === "/login" || p === "/privacy" || p === "/terms");
  if (isPage) {
    accessLog.push({ ts: Date.now(), ip: getIp(req), path: p });
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
  res.setHeader("Set-Cookie",
    `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${SESSION_TTL_MS / 1000}`
  );
  console.log(JSON.stringify({ event: "admin_login_success", ip, t: new Date().toISOString() }));
  res.json({ ok: true });
});

app.post("/admin/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.admin_session) adminSessions.delete(cookies.admin_session);
  res.setHeader("Set-Cookie",
    "admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0"
  );
  res.json({ ok: true });
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

// server.js — Gemini APIキーを秘匿するプロキシサーバー
// 環境変数:
//   GEMINI_API_KEY     (必須) Gemini APIキー
//   GEMINI_MODEL       (任意) デフォルト gemini-2.5-flash
//   ACCESS_PASSWORD    (任意) 設定すると利用者にパスワード必須
//   ADMIN_TOKEN        (任意) 監査ログ参照用トークン
//   RATE_LIMIT_PER_MIN (任意) 1IPあたり1分間のリクエスト上限 (デフォルト 60)
//   RATE_LIMIT_PER_DAY (任意) 1IPあたり1日のリクエスト上限 (デフォルト 500)
//   GLOBAL_DAILY_CAP   (任意) 全体1日のリクエスト上限 (デフォルト 5000)
//   PORT               (任意) ポート番号 (デフォルト 10000)

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_ID = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 60);
const RATE_LIMIT_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY || 500);
const GLOBAL_DAILY_CAP = Number(process.env.GLOBAL_DAILY_CAP || 5000);

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY is not set");
  process.exit(1);
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

// ---------- 監査ログ（メモリ内 + stdout） ----------
const MAX_LOG = 1000;
const auditLog = [];

function logAudit(entry) {
  const enriched = { t: new Date().toISOString(), ...entry };
  console.log(JSON.stringify(enriched));
  auditLog.unshift({ ts: Date.now(), ...entry });
  if (auditLog.length > MAX_LOG) auditLog.length = MAX_LOG;
}

function getIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || "unknown";
}

// ---------- レート制限 ----------
const perIpMin = new Map();
const perIpDay = new Map();
let globalDay = { count: 0, resetAt: Date.now() + 86400000 };

function checkRateLimit(ip) {
  const now = Date.now();
  if (now > globalDay.resetAt) globalDay = { count: 0, resetAt: now + 86400000 };
  if (globalDay.count >= GLOBAL_DAILY_CAP) return { ok: false, reason: "global_daily_cap" };

  let m = perIpMin.get(ip);
  if (!m || now > m.resetAt) { m = { count: 0, resetAt: now + 60000 }; perIpMin.set(ip, m); }
  if (m.count >= RATE_LIMIT_PER_MIN) return { ok: false, reason: "per_ip_per_min" };

  let d = perIpDay.get(ip);
  if (!d || now > d.resetAt) { d = { count: 0, resetAt: now + 86400000 }; perIpDay.set(ip, d); }
  if (d.count >= RATE_LIMIT_PER_DAY) return { ok: false, reason: "per_ip_per_day" };

  return {
    ok: true,
    incr: () => { m.count++; d.count++; globalDay.count++; }
  };
}

// ---------- 静的配信 ----------
app.use(express.static(path.join(__dirname, "public")));

// ---------- アクセスパスワード ----------
function requireAccess(req, res, next) {
  if (!ACCESS_PASSWORD) return next();
  const token = req.headers["x-access-token"] || "";
  if (token !== ACCESS_PASSWORD) {
    logAudit({ event: "auth_fail", ip: getIp(req) });
    return res.status(401).json({ error: { message: "access password required" } });
  }
  next();
}

// ---------- Gemini プロキシ ----------
app.post("/api/generate", requireAccess, async (req, res) => {
  const ip = getIp(req);
  const ua = (req.headers["user-agent"] || "").slice(0, 160);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    logAudit({ event: "rate_limit", ip, reason: rl.reason });
    return res.status(429).json({ error: { message: "rate limited: " + rl.reason } });
  }
  rl.incr();

  const startedAt = Date.now();
  const bodyStr = JSON.stringify(req.body || {});
  const bodySize = bodyStr.length;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL_ID)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(API_KEY)}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      logAudit({ event: "upstream_error", ip, status: upstream.status, bodySize });
      return res.status(upstream.status).type("application/json").send(txt);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    let totalBytes = 0;
    let usage = null;
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      res.write(value);
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line.startsWith("data: ")) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.usageMetadata) usage = ev.usageMetadata;
          } catch {}
        }
      }
    }
    res.end();

    logAudit({
      event: "generate_ok",
      ip, ua,
      durationMs: Date.now() - startedAt,
      bodySize, respBytes: totalBytes,
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      totalTokens: usage?.totalTokenCount ?? null
    });
  } catch (e) {
    logAudit({ event: "proxy_error", ip, msg: e.message });
    try { res.status(500).json({ error: { message: e.message } }); } catch {}
  }
});

// ---------- 管理: 監査ログ ----------
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(404).end();
  const token = req.query.token || req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/admin/logs", requireAdmin, (req, res) => {
  res.json({ log: auditLog, globalDay });
});

app.get("/admin/summary", requireAdmin, (req, res) => {
  const ok = auditLog.filter(x => x.event === "generate_ok");
  const failed = auditLog.filter(x => x.event === "upstream_error" || x.event === "proxy_error");
  const rateLimited = auditLog.filter(x => x.event === "rate_limit");
  const authFail = auditLog.filter(x => x.event === "auth_fail");
  const totalIn = ok.reduce((s, x) => s + (x.promptTokens || 0), 0);
  const totalOut = ok.reduce((s, x) => s + (x.outputTokens || 0), 0);
  // 概算コスト (gemini-2.5-flash 有料枠単価)
  const costUSD = (totalIn * 0.30 + totalOut * 2.50) / 1_000_000;
  res.json({
    okCount: ok.length,
    failedCount: failed.length,
    rateLimitedCount: rateLimited.length,
    authFailCount: authFail.length,
    totalPromptTokens: totalIn,
    totalOutputTokens: totalOut,
    estimatedCostUSD: Number(costUSD.toFixed(4)),
    globalDayCount: globalDay.count,
    globalDayCap: GLOBAL_DAILY_CAP
  });
});

// ---------- ヘルスチェック ----------
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: "startup",
    port: PORT,
    model: MODEL_ID,
    accessPasswordEnabled: !!ACCESS_PASSWORD,
    adminEndpointEnabled: !!ADMIN_TOKEN,
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    rateLimitPerDay: RATE_LIMIT_PER_DAY,
    globalDailyCap: GLOBAL_DAILY_CAP
  }));
});

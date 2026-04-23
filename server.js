// server.js — Vertex AI版: $300無料クレジット枠で高いRPM上限を利用
// 環境変数:
//   GCP_PROJECT_ID          (必須) Google Cloud プロジェクトID
//   GCP_LOCATION            (任意) デフォルト us-central1
//   VERTEX_MODEL            (任意) デフォルト gemini-2.5-flash
//   GOOGLE_APPLICATION_CREDENTIALS       ADCファイルのパス（ローカル gcloud auth 済みなら不要）
//   GOOGLE_APPLICATION_CREDENTIALS_JSON  Service AccountのJSON全文（Render用）
//   ACCESS_PASSWORD         (任意) 利用者パスワード
//   ADMIN_TOKEN             (任意) 監査ログ参照用トークン
//   RATE_LIMIT_PER_MIN      (任意) デフォルト 300
//   RATE_LIMIT_PER_DAY      (任意) デフォルト 5000
//   GLOBAL_DAILY_CAP        (任意) デフォルト 20000
//   PORT                    (任意) デフォルト 10000

import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { VertexAI } from "@google-cloud/vertexai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL_ID = process.env.VERTEX_MODEL || "gemini-2.5-flash";
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 300);
const RATE_LIMIT_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY || 5000);
const GLOBAL_DAILY_CAP = Number(process.env.GLOBAL_DAILY_CAP || 20000);

if (!PROJECT_ID) {
  console.error("[FATAL] GCP_PROJECT_ID is not set");
  process.exit(1);
}

// Service Account JSON を環境変数から読み込むRender向けサポート
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const tmpPath = path.join(os.tmpdir(), "gcp-sa.json");
    fs.writeFileSync(tmpPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
    console.log(JSON.stringify({ event: "adc_from_env_json", path: tmpPath }));
  } catch (e) {
    console.error("[FATAL] Failed to write service account JSON:", e.message);
    process.exit(1);
  }
}

const vertex = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertex.getGenerativeModel({ model: MODEL_ID });

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

// ---------- 監査ログ ----------
const MAX_LOG = 2000;
const auditLog = [];

function sanitize(s) { return s; } // ADCはAPIキーを含まないためサニタイズ不要。互換のため関数は残す

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

  return { ok: true, incr: () => { m.count++; d.count++; globalDay.count++; } };
}

// ---------- 静的配信 ----------
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

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

// ---------- Vertex AI プロキシ ----------
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

  // クライアントは従来と同じ Gemini REST 形式のbodyを送ってくる想定
  //   systemInstruction / contents / generationConfig
  // Vertex SDK 用のrequestに組み替える
  const body = req.body || {};
  const request = {
    contents: body.contents || [],
    ...(body.systemInstruction ? { systemInstruction: body.systemInstruction } : {}),
    ...(body.generationConfig ? { generationConfig: body.generationConfig } : {}),
    ...(body.tools ? { tools: body.tools } : {})
  };

  try {
    const streaming = await generativeModel.generateContentStream(request);

    // クライアントは従来どおり SSE (data: <json>) を期待しているので、それに合わせて再エンコード
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");

    let usage = null;
    let respBytes = 0;
    for await (const item of streaming.stream) {
      // item: {candidates: [...], usageMetadata?: {...}}
      const chunk = "data: " + JSON.stringify(item) + "\n\n";
      respBytes += chunk.length;
      res.write(chunk);
      if (item.usageMetadata) usage = item.usageMetadata;
    }
    // 終了イベント
    res.write("data: [DONE]\n\n");
    res.end();

    logAudit({
      event: "generate_ok",
      ip, ua,
      durationMs: Date.now() - startedAt,
      respBytes,
      promptTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      totalTokens: usage?.totalTokenCount ?? null
    });
  } catch (e) {
    const safeMsg = sanitize(e.message || "unknown");
    logAudit({ event: "proxy_error", ip, msg: safeMsg });
    try {
      if (!res.headersSent) {
        res.status(500).json({ error: { message: safeMsg } });
      } else {
        res.end();
      }
    } catch {}
  }
});

// ---------- 管理 ----------
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
  const failed = auditLog.filter(x => x.event === "proxy_error");
  const rateLimited = auditLog.filter(x => x.event === "rate_limit");
  const authFail = auditLog.filter(x => x.event === "auth_fail");
  const totalIn = ok.reduce((s, x) => s + (x.promptTokens || 0), 0);
  const totalOut = ok.reduce((s, x) => s + (x.outputTokens || 0), 0);
  // gemini-2.5-flash on Vertex: $0.30 in / $2.50 out per 1M tokens
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
    globalDayCap: GLOBAL_DAILY_CAP,
    model: MODEL_ID,
    project: PROJECT_ID,
    location: LOCATION
  });
});

app.get("/health", (req, res) => res.json({ ok: true, model: MODEL_ID }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: "startup",
    port: PORT,
    model: MODEL_ID,
    project: PROJECT_ID,
    location: LOCATION,
    accessPasswordEnabled: !!ACCESS_PASSWORD,
    adminEndpointEnabled: !!ADMIN_TOKEN,
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    rateLimitPerDay: RATE_LIMIT_PER_DAY,
    globalDailyCap: GLOBAL_DAILY_CAP
  }));
});

// server.js — 静的ファイル配信のみ（APIキー・外部サービスへの依存なし / 課金ゼロ）
// 環境変数:
//   PORT (任意) デフォルト 10000

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

app.get("/health", (_req, res) => res.json({ ok: true, mode: "offline" }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log(JSON.stringify({ event: "startup", port: PORT, mode: "offline_static" }));
});

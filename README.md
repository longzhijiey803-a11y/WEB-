# WEBテスト（玉手箱・C-GAB）模擬問題

**Vertex AI** を使った玉手箱・C-GAB形式のWebテスト練習アプリ。
Google Cloud の認証（ADC / Service Account）でアクセスし、APIキー方式より高いRPM枠で高速に動作します。

## 構成

```
/
├── server.js                  Express + Vertex AI SDK プロキシ
├── package.json
├── .env.example
├── .gitignore
└── public/
    ├── index.html             フロントエンド
    └── correct.mov            正解音
```

## 必要な準備

### 1. Google Cloud 側

1. Google Cloudコンソールで**プロジェクトを作成**（既存でも可）
2. **Vertex AI API** を有効化
   - [console.cloud.google.com](https://console.cloud.google.com) → 検索「Vertex AI」→ `Vertex AI API` → **有効にする**
3. **無料クレジット**（初回 $300 / 90日）があれば自動適用される

### 2. 認証設定（どちらか）

**(A) ローカル開発: ADC（Application Default Credentials）**

```bash
# 初回のみ gcloud CLI をインストール
brew install --cask google-cloud-sdk

# ログインしてADCを設定
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

**(B) Render本番: サービスアカウントJSON**

1. Google Cloud → IAM & Admin → **Service Accounts** → **Create Service Account**
2. ロール: `Vertex AI User` を付与
3. 作成後 → Keys → **Add Key → JSON** → ダウンロード
4. JSONの**全文**を Render の Environment Variables `GOOGLE_APPLICATION_CREDENTIALS_JSON` に貼り付け

### 3. ローカル起動

```bash
npm install
cp .env.example .env
# .env を編集: GCP_PROJECT_ID=... を設定
npm start
# http://localhost:10000 を開く
```

### 4. Render デプロイ

Web Service設定:
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node server.js`

Environment Variables（必須）:
| Key | Value |
|---|---|
| `GCP_PROJECT_ID` | あなたのGCPプロジェクトID |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | サービスアカウントJSON全文 |

オプション:
| Key | Value |
|---|---|
| `GCP_LOCATION` | `us-central1` 他（省略可） |
| `VERTEX_MODEL` | `gemini-2.5-flash` 他（省略可） |
| `ACCESS_PASSWORD` | 閲覧制限パスワード |
| `ADMIN_TOKEN` | 監査ログ閲覧トークン |

## 監査ログ

### Renderダッシュボード → Logs タブ

JSON Lines形式で各リクエストを出力:
```json
{"t":"...","event":"generate_ok","ip":"...","durationMs":4200,"promptTokens":890,"outputTokens":1250,"totalTokens":2140}
```

### 管理エンドポイント (ADMIN_TOKEN設定時)

- `GET /admin/summary?token=YOUR_ADMIN_TOKEN` — 累計リクエスト数・推定コスト
- `GET /admin/logs?token=YOUR_ADMIN_TOKEN` — 直近2000件のログ

## 料金

- Vertex AI gemini-2.5-flash: 入力 $0.30/M、出力 $2.50/M
- 初回 **$300 無料クレジット** が90日間有効（個人利用なら数千回テストしてもお釣りが来ます）
- GCP 無料クレジット終了後は従量課金（クレカ登録が必要）

## 安全対策

1. 認証情報はすべて環境変数から読み込み（コードにハードコードなし）
2. サービスアカウントJSONは `.gitignore` 済みの `.env` / Render Env のみに保存
3. 閲覧制限パスワード・レート制限・監査ログを備え、悪用を抑止
4. HTMLレスポンスに `Cache-Control: no-cache` 付与で古いクライアントコードを残さない

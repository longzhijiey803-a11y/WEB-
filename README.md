# Webテスト（論理的読解・英語・計数）

Gemini API を使った玉手箱・GAB形式のWebテスト練習アプリ。APIキーはサーバー側の環境変数に保管され、ブラウザからは見えません。

## 構成

```
/
├── server.js          Express プロキシサーバー（APIキー秘匿 + 監査ログ + レート制限）
├── package.json
├── .env.example       環境変数テンプレート（実際の.envはgit未管理）
├── .gitignore
└── public/
    ├── index.html     フロントエンド
    └── correct.mov    正解音
```

## ローカルでの実行

```bash
# 1. 依存パッケージをインストール
npm install

# 2. .env.example を .env にコピーして APIキーを記入
cp .env.example .env
# エディタで .env を開き GEMINI_API_KEY=AIza... を設定

# 3. サーバー起動
npm start
# http://localhost:10000 を開く
```

## Render へのデプロイ

1. このリポジトリを Render に連携して **Web Service** を新規作成
2. 設定:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: `Node`
3. **Environment Variables** に以下を設定（Renderのダッシュボードで）:
   - `GEMINI_API_KEY` — Gemini API キー（必須）
   - `ACCESS_PASSWORD` — 閲覧制限パスワード（推奨）
   - `ADMIN_TOKEN` — 監査ログ閲覧用トークン（推奨、32文字以上のランダム文字列）
   - `GEMINI_MODEL` — 省略可（デフォルト `gemini-2.5-flash`）
   - `RATE_LIMIT_PER_MIN` / `RATE_LIMIT_PER_DAY` / `GLOBAL_DAILY_CAP` — 任意
4. デプロイ完了後、Render が発行するURLでアクセス

## 監査ログ

### stdout ログ

サーバーへの各リクエストはJSON Lines形式で stdout に出力されます。Render ダッシュボードの **Logs** タブで確認可能。

```json
{"t":"2026-04-22T09:12:34.567Z","event":"generate_ok","ip":"...","durationMs":4521,"bodySize":1534,"respBytes":3211,"promptTokens":892,"outputTokens":1243,"totalTokens":2135}
```

イベント種別:
- `generate_ok` — 正常にGeminiレスポンスを返した
- `upstream_error` — Gemini側エラー（レート制限など）
- `proxy_error` — サーバー内部エラー
- `rate_limit` — レート制限で拒否
- `auth_fail` — アクセスパスワード誤り

### 管理エンドポイント（ADMIN_TOKEN 設定時）

- `GET /admin/summary?token=YOUR_ADMIN_TOKEN` — 累計リクエスト数・トークン数・推定コスト
- `GET /admin/logs?token=YOUR_ADMIN_TOKEN` — 直近1000件の監査ログ

```bash
curl "https://your-app.onrender.com/admin/summary?token=YOUR_ADMIN_TOKEN"
```

## 安全策まとめ

1. **APIキー**: `.env` と Render 環境変数のみに保持。ブラウザからは到達不可能
2. **`.gitignore`**: `.env` 等の秘密ファイルをgit管理外に
3. **ACCESS_PASSWORD**: 閲覧者全員にパスワードを必須化できる
4. **レート制限**: 1IPあたり分間60回 / 日500回、全体5000回/日 でコスト爆発を防止
5. **監査ログ**: リクエスト毎にIP・所要時間・トークン数・概算コストを記録

## 環境変数リファレンス

| 変数名 | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Gemini APIキー |
| `GEMINI_MODEL` | | `gemini-2.5-flash` | 使用モデル |
| `ACCESS_PASSWORD` | | 空 | ユーザーアクセス制限 |
| `ADMIN_TOKEN` | | 空 | 管理APIの認証トークン |
| `RATE_LIMIT_PER_MIN` | | 60 | 1IPあたり/分 |
| `RATE_LIMIT_PER_DAY` | | 500 | 1IPあたり/日 |
| `GLOBAL_DAILY_CAP` | | 5000 | サーバー全体/日 |
| `PORT` | | 10000 | 待受ポート（Renderでは自動） |

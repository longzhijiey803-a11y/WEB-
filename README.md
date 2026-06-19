# WEBテスト（玉手箱・C-GAB）模擬問題

**完全オフライン生成** の玉手箱・C-GAB形式 Webテスト練習アプリ。APIキー・外部サービス・CDN は不要です。**課金ゼロ** で動作します。

## 特徴

- **完全オフライン**: Gemini / Vertex AI / Supabase / その他外部APIへの接続なし
- **算法生成**: 計数問題は JS アルゴリズムで事実上無制限に生成
- **テンプレート生成**: 言語・英語はテンプレート + スロット置換 + セッション毎シャッフル
- **生成中 UI**: 本物らしい「AI 生成中」演出（擬似ストリーミング表示）
- **ローカル保存**: アカウント・成績・アンケートはブラウザ内 localStorage のみに保存

## 構成

```
/
├── server.js              Express 静的配信のみ
├── package.json           依存は express のみ
└── public/
    ├── index.html         フロントエンド
    ├── auth-common.js     ローカル認証・ローカル保存
    ├── generators.js      問題生成ロジック（計数 algorithm / 言語・英語テンプレート）
    └── correct.mov        正解音
```

## モード別内訳

| モード | 方式 | 生成パターン |
|---|---|---|
| 計数 (num) | アルゴリズム | 表 / 円グラフ / 棒グラフ / 折れ線 / 穴埋め表 を数値乱択 |
| 言語 (ja) | テンプレート + スロット置換 | テーマ・論点・設問を実行時に組み合わせ |
| 英語 (en) | 会話/文章テンプレート + スロット置換 | 場面・名前・数値・設問を実行時に組み合わせ |

## ローカル起動

```bash
npm install
npm start
# http://localhost:10000 を開く
```

環境変数は `PORT` (任意) のみ。認証サーバーや API キーは不要。

## Render デプロイ

Web Service 設定:
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node server.js`

環境変数は設定不要（必要なら `PORT` のみ）。

## 費用

**ゼロ**。外部 API を呼ばないため従量課金の発生余地なし。Render Free tier の範囲のみ。

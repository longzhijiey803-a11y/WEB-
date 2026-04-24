# WEBテスト（玉手箱・C-GAB）模擬問題

**完全オフライン生成** の玉手箱・C-GAB形式 Webテスト練習アプリ。APIキー・外部サービス一切不要。**課金ゼロ** で動作します。

## 特徴

- **完全オフライン**: Gemini / Vertex AI / その他外部APIへの接続なし
- **算法生成**: 計数問題は JS アルゴリズムで事実上無制限に生成
- **プール方式**: 言語・英語は手書きプール + セッション毎シャッフル
- **生成中 UI**: 本物らしい「AI 生成中」演出（擬似ストリーミング表示）

## 構成

```
/
├── server.js              Express 静的配信のみ
├── package.json           依存は express のみ
└── public/
    ├── index.html         フロントエンド
    ├── generators.js      問題生成ロジック（計数 algorithm / 言語・英語 プール）
    └── correct.mov        正解音
```

## モード別内訳

| モード | 方式 | 生成パターン |
|---|---|---|
| 計数 (num) | アルゴリズム | 表 / 円グラフ / 棒グラフ / 折れ線 / 穴埋め表 を数値乱択 |
| 言語 (ja) | 16 問のプール | 2 問 × 8 テーマ、セッション毎にシャッフル |
| 英語 (en) | 16 問のプール | 2 問 × 8 テーマ、セッション毎にシャッフル |

## ローカル起動

```bash
npm install
npm start
# http://localhost:10000 を開く
```

環境変数は `PORT` (任意) のみ。認証や API キーは不要。

## Render デプロイ

Web Service 設定:
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node server.js`

環境変数は設定不要（必要なら `PORT` のみ）。

## 費用

**ゼロ**。外部 API を呼ばないため従量課金の発生余地なし。Render Free tier の範囲のみ。

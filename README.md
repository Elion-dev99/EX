# EX Shift

男子学園（dgdgdg.com）のプロフィールページから「出勤スケジュール」を取得し、幹部メンバー分をまとめてカレンダー表示するツールです。

Cloudflare Workers（OpenNext）での運用を前提にしています。

## できること

- 幹部最大6人の公開シフトを横断表示
- 月カレンダーで出勤者を色分け把握
- 日付タップで出勤 / 退勤 / NIGHT / 休みを確認
- プロフィールURLの登録・編集（ローカル開発時）
- 5分キャッシュ付きの再取得

## メンバー

| 名前 | boy_id |
| --- | --- |
| つむぎ | 10235 |
| れんた | 11920 |
| かいせい | 10665 |
| こうや | 11335 |
| かずさ | 10781 |
| こうしん | 11969 |

設定ファイル: `data/members.json`

## ローカル開発

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Cloudflare へデプロイ

OpenNext + Cloudflare Workers 構成済みです。

```bash
npm install
npx wrangler login   # 初回のみ（あなたの Cloudflare アカウント）
npm run deploy
```

Workers ランタイムでの事前確認:

```bash
npm run preview
```

### 注意（サイズ上限）

Next.js + OpenNext の Worker バンドルは大きいため、**Workers Paid（スクリプト上限 10MiB）** が必要です。  
無料枠 / 一時プレビュー（1MiB）ではデプロイできません。

### Workers Builds（Git連携）向け

Cloudflare ダッシュボードで Workers を作成し、このリポジトリを接続する場合:

- **Build command:** `npx opennextjs-cloudflare build`
- **Deploy command:** `npx opennextjs-cloudflare deploy`
- **Root directory:** リポジトリルート

## API

- `GET /api/shifts` … シフト取得（`?refresh=1` で強制再取得）
- `GET /api/members` … メンバー一覧
- `PUT /api/members` … メンバー更新（ローカル開発向け。Cloudflare 本番では `data/members.json` を更新して再デプロイ）

## 注意

- 公開プロフィールに載っているスケジュールのみ取得します
- サイト側の公開範囲外の日付はカレンダーに出ません
- 過度な連続リクエストは避けてください

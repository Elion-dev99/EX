# Cloudflare 自動デプロイ / オートマージ設定

## 1. Cloudflare

1. [Workers Paid](https://dash.cloudflare.com/?to=/:account/workers/plans) を有効化（OpenNext バンドルが無料枠のサイズ上限を超えるため）
2. [API Token](https://dash.cloudflare.com/profile/api-tokens) を作成  
   - テンプレート: **Edit Cloudflare Workers**
3. [Account ID](https://dash.cloudflare.com/?to=/:account) を控える

## 2. GitHub Secrets

リポジトリ `Settings → Secrets and variables → Actions` に追加:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 上記 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

## 3. GitHub Auto-merge

`Settings → General → Pull Requests` で **Allow auto-merge** を ON。

任意: `Settings → Rules → Rulesets` で `main` に

- Require status checks to pass: `CI / check`
- Require branches to be up to date

を付けると、CI 通過後にだけマージされます。

## 4. 動作

```mermaid
PR (cursor/*) → CI → Auto Merge (squash) → main push → Deploy to Cloudflare Workers
```

- `cursor/*` ブランチの PR は `Auto Merge` workflow が auto-merge を有効化
- `main` へマージされると `Deploy` workflow が `ex-shift` Worker をデプロイ

## 5. 手動デプロイ

```bash
npx wrangler login
npm run deploy
```

公開 URL 例: `https://ex-shift.<your-subdomain>.workers.dev`

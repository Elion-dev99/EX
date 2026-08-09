# Cloudflare 自動デプロイ / オートマージ設定

このリポジトリは **private** 想定です。  
公開不要で動かすため、**GitHub Actions + Cloudflare API Token** 方式にしています（Deploy to Cloudflare ボタンは public 専用なので使いません）。

## 1. Cloudflare

1. [Workers Paid](https://dash.cloudflare.com/?to=/:account/workers/plans) を有効化（OpenNext バンドルが無料枠のサイズ上限を超えるため）
2. [API Token](https://dash.cloudflare.com/profile/api-tokens) を作成  
   - テンプレート: **Edit Cloudflare Workers**
3. [Account ID](https://dash.cloudflare.com/?to=/:account) を控える

## 2. GitHub Secrets（private でも同じ）

リポジトリ所有者アカウントで  
`Settings → Secrets and variables → Actions` に追加:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 上記 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

Actions は private リポジトリでもそのまま使えます（GitHub のプラン制限内であれば OK）。

## 3. GitHub Auto-merge

`Settings → General → Pull Requests` で **Allow auto-merge** を ON。

任意: `Settings → Rules → Rulesets` で `main` に

- Require status checks to pass: `CI / check`
- Require branches to be up to date

を付けると、CI 通過後にだけマージされます。

## 補足: Cloudflare Workers Builds を使う場合

Workers Builds（ダッシュボードから Git 連携）でも private は可能です。その場合は GitHub の  
[Cloudflare Workers and Pages App](https://github.com/settings/installations) で、  
**Only select repositories** にこの private リポジトリ（`Elion-dev99/EX`）を含めてください。

ただし今回の本線は GitHub Actions なので、Workers Builds 連携は必須ではありません。

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

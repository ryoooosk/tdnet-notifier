# tdnet-notifier

TDnet の適時開示を 1 日 1 回チェックし、ウォッチリストに入れた銘柄のものだけをメールで通知する。

開発中。通知を通しで実行するエントリポイントはまだ無い（`index.ts` は雛形のまま）。

## 必要なもの

- Node.js 26（`.nvmrc`）
- pnpm（`corepack enable` で `packageManager` のバージョンが入る）

## セットアップ

1. pnpm と依存関係のインストール

```bash
npm i -g corepack
corepack enable
pnpm install
```

1. 設定ファイルの用意

```bash
cp src/config/watchlist.example.jsonc src/config/watchlist.jsonc
cp .env.example .env
```

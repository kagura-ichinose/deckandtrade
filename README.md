# Deck Ledger

レギュレーションごとにデッキ、所持枚数、概算価格、参考リンクを記録する静的サイトです。

## 仕組み

- 表示データは `data/decks.json` から読み込みます。
- 編集パスワードを確認すると、画面からデッキを追加・編集・削除できます。
- 保存時は `api/decks.js` がGitHub APIを使って `data/decks.json` を更新します。
- GitHub Pages側は、更新されたJSONが反映されると同じ内容を表示します。

## 公開前の設定

1. GitHub Pagesでこのリポジトリを公開します。
2. VercelなどのNode.jsサーバーレス環境に同じリポジトリを接続します。
3. Vercelの環境変数に `.env.example` と同じ項目を設定します。
4. `site.config.js` の `apiEndpoint` に、VercelのAPI URLを入れます。

例:

```js
window.DECK_LEDGER_CONFIG = {
  dataUrl: "data/decks.json",
  apiEndpoint: "https://your-vercel-app.vercel.app/api/decks"
};
```

`GITHUB_TOKEN` は対象リポジトリの Contents を読み書きできる権限にしてください。トークンや編集パスワードは、GitHubにコミットせず、Vercel側の環境変数だけに保存します。

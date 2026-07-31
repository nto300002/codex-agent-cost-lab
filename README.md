# Codex Agent Cost Lab

Codexのプロンプト設計と `AGENTS.md` が、AIエージェントのトークン消費、コスト、探索行動、実行時間、成功率へ与える影響を比較するための実験プロジェクトです。

実験用アプリ **TraceCRM**、比較実験の設計、LT発表の背景を文書化しています。

## Documentation

文書の構成と読む順番は [`docs/README.md`](docs/README.md) を参照してください。

## Local development

必要なツール:

- Node.js 24.18.0
- pnpm 11.18.0

```bash
pnpm install --frozen-lockfile
pnpm dev
```

品質チェック:

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

## Status

要件定義と実験設計を完了し、TraceCRMのアプリケーション基盤を実装中です。実験ハーネスは今後実装します。

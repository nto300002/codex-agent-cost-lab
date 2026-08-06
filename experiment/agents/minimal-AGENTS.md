# TraceCRM repository instructions

## Technology

- Node.js 24.18.0、pnpm 11.18.0、TypeScript strict modeを使用する。
- Next.js 16 App Router、React 19、Prisma 7、SQLiteで構成される。
- 単体・結合テストはVitest、E2EテストはPlaywrightを使用する。

## Responsibilities

- `app/`: ページとRoute Handlerのエントリーポイント。
- `src/features/`: 機能別のdomain、application、infrastructure、http、presentation。
- `src/shared/`: 複数機能で共有する境界とユーティリティ。
- `prisma/`: schema、migration、固定Seed。
- `tests/`: 結合・E2E・実験基盤のテスト。

## Official commands

- 変更に近いテスト: `pnpm test:<feature>`
- 単体・結合テスト: `pnpm test`
- 型検査: `pnpm typecheck`
- Lint: `pnpm lint`
- 書式検査: `pnpm format:check`
- E2Eテスト: `pnpm test:e2e`
- 全公開検証: `pnpm experiment:verify`
- 開発DB再作成: `pnpm db:reset`

## Forbidden areas

- 依頼に明記されない限り、依存関係、Prisma schema、migration、Seedを変更しない。
- `.github/`、`experiment/`、評価資産、生成物、ローカルDB、環境・認証情報を変更しない。
- 認可をUI表示だけで代替せず、既存の公開API互換性を壊さない。
- タスク外のリファクタリングや整形を含めず、必要最小限の差分にする。

## Stop conditions

- 要件が矛盾する、必要な外部状態がない、禁止領域の変更が必要、または安全な検証ができない場合は停止する。
- 停止時は、確認できた事実、未解決事項、必要な判断を報告する。

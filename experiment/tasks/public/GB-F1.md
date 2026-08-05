# GB-F1: MEMBERによる担当外Deal更新を拒否する

## Request

- MEMBERが担当外のDealを更新できる認可不具合を修正してください。

## Acceptance criteria

- MEMBERは担当外Dealを更新できない。
- MANAGERとADMINは担当者にかかわらず更新できる。
- 未認証リクエストは401になる。
- 認可不足は403になる。
- UIの表示制御だけでなくAPIで更新を防止する。
- 既存のDeal閲覧権限を壊さない。

## Constraints

- ロール定義と公開API形式を変更しない。
- Prisma schemaとmigrationを変更しない。

## Validation

- `pnpm test:deal`
- `pnpm exec playwright test tests/e2e/deal.spec.ts`
- `pnpm typecheck`

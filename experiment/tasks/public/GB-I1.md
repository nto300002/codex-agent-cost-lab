# GB-I1: Customer一覧へStatus・Owner絞り込みを追加する

## Request

- Customer一覧へStatusとOwnerの絞り込みを追加してください。

## Acceptance criteria

- Status単独で絞り込める。
- Owner単独で絞り込める。
- StatusとOwnerを組み合わせて絞り込める。
- ページネーション時に絞り込み条件を維持する。
- MEMBERは自分の閲覧範囲を越えない。
- API、UI、関連テストを更新する。

## Constraints

- 既存のCustomer検索条件との互換性を維持する。
- Prisma schemaとmigrationを変更しない。

## Validation

- `pnpm test:customer`
- `pnpm exec playwright test tests/e2e/customer.spec.ts`
- `pnpm typecheck`

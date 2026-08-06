# GA-I1: Customer一覧へ最終更新日時を表示する

## Request

- Customer一覧テーブルへ各顧客の最終更新日時を追加してください。

## Acceptance criteria

- 最終更新日時をAsia/Tokyoで表示する。
- 一覧APIの既存レスポンス互換性を維持する。
- 顧客一覧テーブルへ更新日時列を追加する。
- 不要なDB変更を行わない。
- UIテストと型検査が成功する。

## Constraints

- 日時の保存形式とPrisma schemaを変更しない。
- 顧客詳細画面の表示仕様を変更しない。

## Validation

- `pnpm test:customer`
- `pnpm typecheck`

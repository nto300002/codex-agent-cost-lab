# GA-F1: Customer更新時の空電話番号を正規化する

## Request

- Customer更新APIへ `phone: ""` を送ると500になる不具合を修正してください。

## Acceptance criteria

- 空文字または空白だけの電話番号は `null` として保存される。
- `phone` 未指定時は既存値を維持する。
- 不正な電話番号入力は500ではなく400になる。
- 公開APIのリクエスト・レスポンス形式を変更しない。
- 関連テストと型検査が成功する。

## Constraints

- Prisma schemaとmigrationを変更しない。
- Customer以外の機能仕様を変更しない。

## Validation

- `pnpm test:customer`
- `pnpm typecheck`

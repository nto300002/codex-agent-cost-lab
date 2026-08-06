# GC-I1: 主要操作へAuditLogを追加する

## Request

- Customer、Deal、Activityの主要操作を既存AuditLog基盤へ記録してください。

## Acceptance criteria

- CustomerのCREATEとUPDATEを記録する。
- DealのCREATE、UPDATE、DELETEを記録する。
- ActivityのCREATE、UPDATE、DELETEを記録する。
- Actor、Entity、変更前後、日時を記録する。
- パスワード、セッション、Cookieなどの機密情報を記録しない。
- 業務処理と監査記録を同一トランザクションで実行する。
- 監査失敗時の扱いを全操作で統一する。
- 追加ログを既存のADMIN用一覧・絞り込みで閲覧できる。
- 単体、結合、E2Eテストが成功する。

## Constraints

- AuditLogの公開レスポンス形式を変更しない。
- 既存の認可範囲を拡大しない。
- ログ記録のために個人情報を追加取得しない。

## Validation

- `pnpm test:audit`
- `pnpm test:customer`
- `pnpm test:deal`
- `pnpm test:activity`
- `pnpm exec playwright test tests/e2e/audit.spec.ts`
- `pnpm typecheck`

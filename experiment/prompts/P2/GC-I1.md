# GC-I1: 主要操作へAuditLogを追加する

## 目的

- Customer、Deal、Activityの主要操作を既存AuditLog基盤へ記録してください。

## 再現条件または要求仕様

- CustomerのCREATEとUPDATEを記録する。
- DealのCREATE、UPDATE、DELETEを記録する。
- ActivityのCREATE、UPDATE、DELETEを記録する。
- Actor、Entity、変更前後、日時を記録する。
- パスワード、セッション、Cookieなどの機密情報を記録しない。
- 業務処理と監査記録を同一トランザクションで実行する。
- 監査失敗時の扱いを全操作で統一する。
- 追加ログを既存のADMIN用一覧・絞り込みで閲覧できる。
- 単体、結合、E2Eテストが成功する。

## 最初に調査する範囲

- 依頼対象の機能、その呼び出し経路、既存テストを確認する。
- 実装箇所や原因を前提にせず、現在の実装から根拠を集める。

## 変更してよい範囲

- 受入条件を満たすために必要なアプリケーションコードとテスト。
- 既存設計に沿った必要最小限の変更。

## 変更してはいけない範囲

- AuditLogの公開レスポンス形式を変更しない。
- 既存の認可範囲を拡大しない。
- ログ記録のために個人情報を追加取得しない。

## テスト方針

- `pnpm test:audit`
- `pnpm test:customer`
- `pnpm test:deal`
- `pnpm test:activity`
- `pnpm exec playwright test tests/e2e/audit.spec.ts`
- `pnpm typecheck`

- 変更に近い検証から実行し、失敗した場合は原因を確認する。

## 停止条件

- 外部状態や不足情報により安全に完了できない場合は、変更範囲を広げず停止する。
- 受入条件と矛盾する変更、または禁止範囲の変更が必要になった場合は理由を報告する。

## 完了条件

- CustomerのCREATEとUPDATEを記録する。
- DealのCREATE、UPDATE、DELETEを記録する。
- ActivityのCREATE、UPDATE、DELETEを記録する。
- Actor、Entity、変更前後、日時を記録する。
- パスワード、セッション、Cookieなどの機密情報を記録しない。
- 業務処理と監査記録を同一トランザクションで実行する。
- 監査失敗時の扱いを全操作で統一する。
- 追加ログを既存のADMIN用一覧・絞り込みで閲覧できる。
- 単体、結合、E2Eテストが成功する。

- 指定された検証が成功し、未解決事項が明示されている。

## 最終報告形式

- 変更内容
- 実行した検証と結果
- 未実施の検証、残る問題、停止理由

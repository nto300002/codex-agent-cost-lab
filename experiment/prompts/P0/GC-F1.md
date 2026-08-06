# GC-F1: Customer削除時の関連データ整合性を保証する

Customer削除後に関連データが残りAuditLogも不正確になる不具合を修正してください。

完了条件: Customer削除処理を単一トランザクションで実行する。 / 関連するDeal、Activity、CustomerTagを規定どおり削除する。 / 途中で失敗した場合はすべての変更をロールバックする。 / Customer削除のAuditLogを正確に1件記録する。 / 削除前情報を機密情報を含めず記録する。 / MEMBERとMANAGERからの削除を拒否する。 / 単体、結合、E2Eの回帰テストが成功する。

制約: Customerは物理削除とする。 / DBの外部キーをCascadeへ変更して解決しない。 / AuditLog失敗時だけ業務削除を確定させない。

確認: `pnpm test:customer` / `pnpm exec playwright test tests/e2e/customer-delete.spec.ts` / `pnpm typecheck`

原因と影響範囲を確認して必要最小限の変更を行い、確認結果と残る問題を報告してください。外部状態や不足情報により安全に完了できない場合は、変更を広げず理由を報告してください。

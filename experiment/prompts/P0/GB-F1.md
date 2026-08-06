# GB-F1: MEMBERによる担当外Deal更新を拒否する

MEMBERが担当外のDealを更新できる認可不具合を修正してください。

完了条件: MEMBERは担当外Dealを更新できない。 / MANAGERとADMINは担当者にかかわらず更新できる。 / 未認証リクエストは401になる。 / 認可不足は403になる。 / UIの表示制御だけでなくAPIで更新を防止する。 / 既存のDeal閲覧権限を壊さない。

制約: ロール定義と公開API形式を変更しない。 / Prisma schemaとmigrationを変更しない。

確認: `pnpm test:deal` / `pnpm exec playwright test tests/e2e/deal.spec.ts` / `pnpm typecheck`

原因と影響範囲を確認して必要最小限の変更を行い、確認結果と残る問題を報告してください。外部状態や不足情報により安全に完了できない場合は、変更を広げず理由を報告してください。

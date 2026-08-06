# GB-I1: Customer一覧へStatus・Owner絞り込みを追加する

Customer一覧へStatusとOwnerの絞り込みを追加してください。

完了条件: Status単独で絞り込める。 / Owner単独で絞り込める。 / StatusとOwnerを組み合わせて絞り込める。 / ページネーション時に絞り込み条件を維持する。 / MEMBERは自分の閲覧範囲を越えない。 / API、UI、関連テストを更新する。

制約: 既存のCustomer検索条件との互換性を維持する。 / Prisma schemaとmigrationを変更しない。

確認: `pnpm test:customer` / `pnpm exec playwright test tests/e2e/customer.spec.ts` / `pnpm typecheck`

原因と影響範囲を確認して必要最小限の変更を行い、確認結果と残る問題を報告してください。外部状態や不足情報により安全に完了できない場合は、変更を広げず理由を報告してください。

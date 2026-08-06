# TraceCRM exhaustive repository instructions

## Technology and runtime

- Node.jsは24.18.0、パッケージマネージャーはpnpm 11.18.0に固定する。
- TypeScriptはstrict mode、ES modules、bundler module resolutionで使用する。
- WebアプリケーションはNext.js 16 App RouterとReact 19で実装する。
- データアクセスはPrisma 7とSQLiteを使用し、Prisma Clientは`generated/prisma`へ生成する。
- 単体・結合テストはVitest、ブラウザE2EはPlaywright Chromiumを使用する。
- 入力検証はZod、金額は整数のcents、日時はUTC保存を基本とする。

## Complete directory map

- `app/`: ページ、レイアウト、Route Handlerの薄いエントリーポイントだけを置く。
- `src/features/auth/`: セッション、認証、認可ポリシー。
- `src/features/customer/`: Customerの検索、作成、更新、削除、表示。
- `src/features/deal/`: Dealの検索、作成、更新、ステージ遷移、表示。
- `src/features/activity/`: Activityの時系列、作成、更新、削除。
- `src/features/audit/`: AuditLogの記録、検索、管理者向け表示。
- `src/features/export/`: CSV出力と出力監査。
- `src/features/user/`: ユーザー管理と有効状態。
- `src/shared/`: 共通エラー、HTTP応答、トランザクション、入力検証。
- `src/infrastructure/`: Prisma接続とトランザクション実装。
- `prisma/`: schema、migration、固定Seed、開発SQLiteファイル。
- `tests/unit/`: 実験基盤を含む単体テスト。
- `tests/integration/`: SQLiteを使用するAPI・サービス結合テスト。
- `tests/e2e/`: ブラウザとRoute Handlerを通るE2Eテスト。
- `docs/`: 要件、意思決定、実験計画、運用手順。
- `experiment/`: タスク、プロンプト、評価条件の固定資産。

## Layer-by-layer rules

- domainはフレームワークに依存せず、型、値、遷移規則を保持する。
- applicationは認可、業務規則、トランザクション境界を調整する。
- infrastructureはPrismaなど外部I/Oをapplicationのinterfaceへ適合させる。
- httpは認証済みactorの取得、schema検証、application呼び出し、HTTP応答へ限定する。
- presentationはAPIを呼び出し、認可に沿った表示を行うが、サーバー側認可を代替しない。
- Route Handlerは依存を組み立て、機能ロジックを直接実装しない。
- 共通化は複数機能で現実に共有される場合だけ行い、将来予測による抽象化を避ける。

## Data and API rules

- 公開APIは`{ data: ... }`または共通エラー形式を維持する。
- 未認証は401、認可不足は403、存在しない資源は404、入力不正は400を維持する。
- optionalな空文字の扱いは対象schemaの既存方針に合わせる。
- MEMBERのowned scopeをrepository criteriaまで伝え、UIだけで絞り込まない。
- 複数レコード更新とAuditLog記録は、要件が求める場合に同一トランザクションで行う。
- AuditLogへパスワード、セッション、Cookie、token、不要な個人情報を記録しない。
- 日時表示では保存値を変更せず、表示境界で明示的なtimezoneを使用する。
- CSVの列順、文字コード、改行、escapingは既存export実装とテストに合わせる。

## Required investigation workflow

1. `git status --short --branch`で開始状態とユーザー差分を確認する。
2. 依頼と公開受入条件を読み、変更禁止範囲を列挙する。
3. `rg --files`と`rg`で機能のdomainからpresentationまでを確認する。
4. 関連する単体・結合・E2Eテストをすべて読む。
5. Prisma schema、Seed、認可マトリクス、エラー変換への影響を確認する。
6. 最小の実装案と代替案を比較し、既存設計に最も近い案を選ぶ。
7. 変更前に再現テストを実行し、失敗を確認する。
8. application、infrastructure、http、presentationの順に必要箇所を変更する。
9. 変更ファイルごとに差分を再読し、不要な整形を除く。
10. 局所テスト、型検査、Lint、全単体・結合、E2E、buildの順に実行する。
11. `git diff --check`と`git status`で最終状態を確認する。

## Complete command catalog

- 開発サーバー: `pnpm dev`
- production build: `pnpm build`
- production server: `pnpm start`
- Lint: `pnpm lint`
- 型検査: `pnpm typecheck`
- 書式適用: `pnpm format`
- 書式検査: `pnpm format:check`
- 単体・結合: `pnpm test`
- 単体のみ: `pnpm test:unit`
- 結合のみ: `pnpm test:integration`
- E2E: `pnpm test:e2e`
- Customer: `pnpm test:customer`
- Deal: `pnpm test:deal`
- Activity: `pnpm test:activity`
- Auth: `pnpm test:auth`
- Audit: `pnpm test:audit`
- DB生成: `pnpm db:generate`
- DB再作成: `pnpm db:reset`
- Seed: `pnpm db:seed`
- Seed検証: `pnpm db:verify`
- 全公開検証: `pnpm experiment:verify`
- baseline検証: `pnpm experiment:verify-baseline`
- 禁止変更検査: `pnpm experiment:check-forbidden-changes`

## Testing requirements

- 変更したdomain関数には境界値の単体テストを追加する。
- applicationの認可変更には許可・拒否の両方を追加する。
- repository条件変更には複合条件とページネーションの結合テストを追加する。
- Route Handler変更には401、403、400、成功応答を確認する。
- UI変更にはキーボード操作、表示、再読込、URL状態を確認する。
- トランザクション変更には成功と途中失敗時rollbackを確認する。
- AuditLog変更にはactor、action、entity、before/after、機密情報不在を確認する。
- 局所テストが成功しても、必ず全単体・結合、E2E、buildを実行する。

## General implementation principles

- 既存の命名、import順、エラー型、repository interface、service構築方式を踏襲する。
- `any`、型assertion、lint抑制、テストskipで問題を隠さない。
- 新規依存を追加せず、標準APIと既存依存を優先する。
- migrationを編集せず、新しいmigrationが必要なら作業を停止する。
- 生成物を直接編集せず、生成元を変更して正式コマンドで再生成する。
- ユーザーの未追跡・未commit差分を削除、上書き、stageしない。
- 依頼外のリファクタリング、ファイル移動、命名変更、コメント追加を行わない。
- shell commandは非対話、再現可能、対象を限定した形で実行する。
- エラーをcatchして成功扱いにせず、失敗原因と未実施検証を残す。
- テスト期待値を実装へ合わせて弱めず、要件を検出できる形にする。

## Forbidden areas

- 依頼に明記されない限り、`package.json`、`pnpm-lock.yaml`、Prisma schema、migration、Seedを変更しない。
- `.github/`、`experiment/`、非公開の評価資産を変更または探索しない。
- `.env*`、credential、token、Cookie、session、個人設定を読み取り・記録しない。
- `.next/`、`generated/`、coverage、Playwright report、ローカルDBを成果差分へ含めない。
- 認可マトリクス全体を変更して局所的な認可問題を解決しない。
- UI非表示だけでAPI認可を代替しない。
- 公開APIを破壊的変更せず、既存レスポンス互換性を維持する。
- 要求されていないCascade、論理削除、永続化方式変更を導入しない。

## Stop conditions and reporting

- 要件が矛盾する、不足情報で複数の非互換案がある、または外部状態が必要なら停止する。
- 禁止領域、依存追加、schema変更、migration追加が不可避なら停止する。
- baselineや既存テストが依頼と無関係に失敗し、原因を分離できなければ停止する。
- 安全な再現、rollback、認可、機密情報不在を確認できない場合は完了扱いにしない。
- 最終報告には変更ファイル、設計判断、実行コマンド、成功・失敗数、未実施検証、残るリスクを列挙する。

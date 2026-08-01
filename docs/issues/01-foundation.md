# M1: 設計・基盤

## ISSUE-001: 未確定の設計判断を固定する

- 種別: decision
- 依存: なし
- 状態: 決定済み
- 決定記録: [ADR-0001: TraceCRM技術ベースライン](../decisions/0001-tracecrm-technology-baseline.md)
- 目的: 実装と実験結果を揺らす技術選択を開始前に確定する。

### スコープ

- Next.js、Node.js、pnpm、Prisma等のバージョン
- CSS Modules採用
- DB管理セッション
- Customerの物理削除とトランザクション方針
- AuditLogの基準機能とGC-I1で拡張する範囲
- E2EをG-B/G-Cの評価に使用する方針

### 受入条件

- すべての未確定事項に決定と理由が記載されている。
- 実験開始後に固定する項目と固定時点が明記されている。
- MVP外の機能が増えていない。

### 検証

- `docs/trace-crm/06-delivery-plan.md` と決定内容が矛盾しないことをレビューする。

---

## ISSUE-002: Next.jsプロジェクトと開発ツールを初期化する

- 種別: foundation
- 依存: ISSUE-001
- 状態: 実装済み
- 目的: バージョン固定された最小のTypeScriptアプリを用意する。

### スコープ

- Next.js App Router、TypeScript、pnpm
- ESLint、Prettier、CSS Modules
- `.node-version` または `.nvmrc`
- `packageManager` とロックファイル
- `dev`、`build`、`lint`、`typecheck`、`format`、`format:check` コマンド

### 受入条件

- `pnpm install` と `pnpm build` が成功する。
- `pnpm lint`、`pnpm typecheck`、`pnpm format:check` が成功する。
- トップページをローカルで表示できる。
- バージョンが設定ファイルとロックファイルで固定されている。

### 検証

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

---

## ISSUE-003: Prisma・SQLite・固定Seedを構築する

- 種別: foundation
- 依存: ISSUE-002
- 状態: 実装済み
- 目的: 毎回同じ状態へ戻せる永続化基盤を作る。

### スコープ

- User、Customer、Deal、Activity、Tag、CustomerTag、AuditLog
- Prisma migration
- 固定ID・固定日時を持つSeed
- `db:reset` と `db:seed`

### 受入条件

- 1コマンドでDBを再生成できる。
- 再生成を複数回行っても同じレコード内容になる。
- 外部DBや外部サービスを必要としない。
- Seed規模が要件の件数を満たす。

### 検証

```bash
pnpm db:reset
pnpm db:seed
```

---

## ISSUE-004: 共通エラー・検証・Clock・トランザクション基盤を実装する

- 種別: foundation
- 依存: ISSUE-003
- 状態: 実装済み
- 目的: 各機能が共通利用する決定的なアプリケーション基盤を作る。

### スコープ

- エラー分類とHTTP変換
- Zod入力検証
- 差し替え可能なClock
- Prismaトランザクション境界
- ログへ秘密情報を出さない共通方針
- 後続機能を単体検証するための最小Vitest設定

### 受入条件

- validation、authentication、authorization、not found、conflictを区別できる。
- テストから時刻を固定できる。
- Route Handlerへ複雑な業務ルールを書かずに利用できる。

### 検証

- エラー変換、Clock、トランザクション補助の単体テストが成功する。

---

## ISSUE-005: テスト基盤と統合検証コマンドを用意する

- 種別: test
- 依存: ISSUE-002、ISSUE-003、ISSUE-004
- 目的: 局所テストと全体検証を明確に分離する。

### スコープ

- Vitest設定拡張、Playwright
- factory、fixture、DBテストhelper
- `test:unit`、`test:integration`、`test:e2e`
- `test:customer`、`test:deal`、`test:activity`、`test:auth`、`test:audit`
- `experiment:verify`

### 受入条件

- 各コマンドが独立して実行できる。
- テスト順序に依存しない。
- `experiment:verify` が型、Lint、公開テストをまとめて検証する。

### 検証

```bash
pnpm experiment:verify
```

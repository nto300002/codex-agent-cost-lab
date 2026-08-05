# M4: 品質・基準状態

## ISSUE-016: 主要フローの結合・E2Eテストを完成させる

> 実装済み: 主要フローの正常系・重要異常系を結合・E2Eで補完し、G-B/G-Cの対象範囲、外部通信遮断、DB分離、遅いテストの識別基準を `tests/README.md` に固定した。

- 種別: test
- 依存: ISSUE-009〜ISSUE-015
- 目的: 実験タスク以外の回帰を自動判定できるようにする。

### スコープ

- ログイン
- Customer CRUD・検索
- Deal CRUD・認可
- Activity CRUD
- ADMINユーザー管理
- CSV、AuditLog

### 受入条件

- 各主要フローに正常系と重要な異常系がある。
- G-B/G-C評価で使用するE2E範囲が明記されている。
- テストは外部通信と実行順序に依存しない。
- 目標実行時間を超える場合、遅いテストを識別できる。

### 検証

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

---

## ISSUE-017: 実験用基準状態と禁止変更検査を固定する

> 実装済み: 基準状態の完全検証、Seed二重再生成、禁止資産検査、リポジトリ外マニフェスト記録、隠し評価資産の隔離手順を固定した。

- 種別: experiment
- 依存: ISSUE-016
- 目的: すべての試行を同一状態から開始し、基準外変更を検出する。

### スコープ

- `verify-baseline`
- `check-forbidden-changes`
- DB、Seed、Clockの再現性検査
- 生成物、秘密情報、実験評価資産の混入検査
- 基準コミットの記録方法

### 受入条件

- クリーンな基準状態で `pnpm experiment:verify` が成功する。
- 同じコミットからDB状態を再現できる。
- 禁止ファイルの変更を検知して非0で終了する。
- Codexから隠し評価資産へアクセスできない。

### 検証

```bash
pnpm db:reset
pnpm experiment:verify
```

# 基準状態の固定と評価資産の隔離

## 1. 目的

すべての実験試行を同一コミット、同一DB、同一Seed、同一Clockから開始し、Codex用ワークスペースへ生成物、秘密情報、隠し評価資産が混入することを防ぐ。

## 2. 基準候補の検証

基準候補はコミット済みで、未追跡ファイルを含めて作業ツリーが空でなければならない。

```bash
pnpm experiment:verify-baseline
```

このコマンドは次を順に確認する。

1. lint、型検査、整形、公開テスト、E2E、production buildが成功する。
2. Git作業ツリーがクリーンである。
3. 禁止された生成物、秘密情報、隠し評価資産、ワークスペース外へのシンボリックリンクがない。
4. `FixedClock`が `2026-01-01T00:00:00.000Z` を再現する。
5. DBを2回リセットし、件数と論理データのSHA-256が一致する。

`prisma/*.db`のファイルハッシュはSQLite内部表現に依存するため比較しない。全テーブルを安定順でJSON化した論理チェックサムを比較する。

## 3. 禁止変更検査

```bash
pnpm experiment:check-forbidden-changes
```

次を検出した場合は非0で終了する。

- `.next`、`generated`、DB、coverage、Playwright reportなどの生成物がGit管理対象または非ignoreの未追跡物として混入
- `.env`、秘密鍵、credentials、代表的なトークン形式
- `hidden-tests`、`hidden-evaluation`、`reference.patch`、`evaluation.json`
- リポジトリ外を参照するシンボリックリンク

`.env.example`は秘密値を含まないテンプレートとして許可する。

## 4. 基準コミットの記録

基準コミットをマージした後、実験ハーネス側のパスへ不変マニフェストを一度だけ作成する。

```bash
pnpm experiment:record-baseline /absolute/path/outside/base-repo/experiment-manifest.json
```

出力には開始コミット、固定Clock、Seed件数・チェックサム、lockfile・Prisma schema・SeedソースのSHA-256を含める。自己参照を避けるため、出力先はCodex用リポジトリ外に限定し、既存ファイルは上書きしない。

各試行のpreflightは、マニフェストのコミットをcheckoutしてから基準検証を実行する。試行間で差分を引き継がず、毎回新しい隔離ワークスペースを作る。

## 5. 隠し評価資産の隔離境界

隠しテスト、正解パッチ、採点設定は実験ハーネスの `hidden-evaluation/` または `tasks/*/hidden-tests/` に置き、Codexのsandbox root、カレントディレクトリ、環境変数、シンボリックリンクのいずれからも参照させない。

```text
experiment-root/
├── base-repo/             # Codexへ渡す
├── workspaces/run-*/      # Codexへ渡す一時clone
├── hidden-evaluation/     # evaluatorだけが読む
└── results/               # Codex終了後にevaluatorが書く
```

Codex実行中に隠し評価を起動しない。Codex終了後、ハーネス側の評価プロセスが成果差分を読み、リポジトリ外から隠しテストを実行する。

# M6: 実験実行・分析

## ISSUE-023: 隔離ワークスペースと実験ランナーを実装する

状態: 実装済み（`scripts/experiment-runner.ts`、実Codex実行前のモデル・予算承認を除く）

- 種別: experiment
- 依存: ISSUE-019〜ISSUE-022
- 目的: 全試行を同じ開始状態・設定で非対話実行する。

### スコープ

- タスク別ワークスペース作成
- 開始コミット復元、DBリセット
- P0/P1/P2とAGENTS条件の配置
- `codex exec --json`
- タイムアウト、終了コード、stdout/stderr、成果物保存

### 受入条件

- run IDが `GB-I1-P2-run03` 形式で一意になる。
- 失敗・タイムアウト時にもログと作業ツリーを保存する。
- ネットワーク、モデル、reasoning effort、sandboxを固定できる。
- 実行順をSeed付きでランダム化できる。

### 検証

- ダミー1タスクを連続実行し、互いの状態が混入しないことを確認する。

### 実装メモ

- `createRunPlan`は反復ごとに全タスク×P0/P1/P2のブロックを作り、保存したSeedから決定論的にシャッフルする。run IDは`<task>-<condition>-runNN`で生成し、重複を拒否する。
- `runExperiment`は開始コミットからrun専用detached worktreeを作り、private assetのsetup patch、依存準備、`pnpm db:reset`、AGENTS条件の順に適用する。Codex起動直前の状態をprepared baselineとして隔離worktree内だけでコミットし、setup差分とCodexの変更を分離する。開発者のcheckoutをreset・cleanしない。
- Codexはユーザー設定・rules・セッション永続化を無効にし、モデル、reasoning effort、`workspace-write` sandbox、承認なし、sandbox内ネットワークなし、Web検索なしを引数で固定する。
- stdout JSONL、stderr、最終メッセージ、準備ログ、diff、git status、manifestをworktree外へ保存する。成功・失敗・timeoutのいずれでもworktreeを自動削除しない。
- 実Codexを呼ばないfixtureで同一タスクを2回連続実行し、run間の変更が混入しないこと、およびtimeout後も部分ログとworktreeが残ることを検証する。

実行順ファイルの生成例（出力先は公開リポジトリ外）:

```bash
pnpm experiment:plan-runs --seed lt-main-2026 --repetitions 5 \
  --output /path/to/experiment-results/run-plan.json
```

実試行はモデル、reasoning effort、タイムアウト、予算の承認後に次の形式で開始する。既定の準備処理は`pnpm install --frozen-lockfile`と`pnpm db:reset`であり、private asset rootを明示する。

```bash
pnpm exec tsx scripts/experiment-runner.ts run \
  --task GB-I1 --condition P2 --repetition 3 \
  --model <fixed-model> --reasoning-effort <fixed-effort> \
  --timeout-minutes <approved-minutes> \
  --work-root /path/to/experiment-worktrees \
  --result-root /path/to/experiment-results/raw \
  --asset-root /path/to/codex-agent-cost-lab-evaluation
```

---

## ISSUE-024: Codex JSONLパーサーを実装する

状態: 実装済み（`scripts/parse-codex-jsonl.ts`）

- 種別: experiment
- 依存: ISSUE-023
- 目的: 実行軌跡からトークン、探索、コマンド、時間を抽出する。

### スコープ

- `turn.completed` の集計
- input、cached input、output、reasoning output
- コマンド、テスト、横断検索、ファイル参照
- 変更ファイル・行数
- 未知イベントと不完全JSONLの扱い

### 受入条件

- キャッシュ入力と推論出力を二重加算しない。
- 複数ターンとサブエージェントを同じrunへ集計できる。
- パース不能なイベントを黙って破棄しない。
- 要件のrun JSON形式を出力する。

### 検証

- 固定fixtureと期待集計値による単体テストが成功する。

### 実装メモ

- `turn.completed.usage`を全thread・全turnで合算し、cached inputとreasoning outputを独立項目として保持する。非キャッシュ入力だけを`input - cached input`で算出する。
- `item.started`、`item.updated`、`item.completed`をthread ID＋item IDで統合し、コマンドを二重計数しない。未完了item/turnは診断情報へ残す。
- コマンドからテスト、全テスト、横断検索、明示的ファイル参照を抽出する。変更ファイルと追加・削除行はrunのunified diffを正とする。
- 未知イベント、未知item type、不正JSON、usage不正を破棄せず、run JSONの`parser`診断へ保存する。
- 要件19章のsnake_case形式へ、run manifest、operator task定義、JSONL、diffを統合して出力する。Codex実行時間とCLIバージョンはrunner manifestから取得し、評価・料金項目は後続ISSUE-025・ISSUE-026が上書きする初期値とする。

```bash
pnpm experiment:parse-run \
  --jsonl /path/to/run/codex.jsonl \
  --manifest /path/to/run/manifest.json \
  --diff /path/to/run/diff.patch \
  --output /path/to/run/run.json
```

---

## ISSUE-025: 自動評価と人手評価入力を統合する

状態: 実装済み（`scripts/evaluate-experiment-run.ts`）

- 種別: experiment
- 依存: ISSUE-020、ISSUE-023、ISSUE-024
- 目的: 実行結果へ成功判定、品質、禁止変更、人手修正量を付与する。

### スコープ

- 隠しテスト・回帰テスト実行
- quality score
- forbidden change
- human fix minutes、レビュー指摘入力
- 評価ログ

### 受入条件

- 評価失敗と実装失敗を区別して記録する。
- 失敗実行も総コスト集計の対象になる。
- 人手入力の担当者と入力日時を追跡できる。

### 検証

- 正解、部分点、禁止変更、評価器異常のfixtureで検証する。

### 実装メモ

- private evaluatorをworkspace外から実行し、隠し評価、公開回帰、変更範囲、禁止変更の点数とログをrunへ統合する。
- 評価器が終了コード1でも有効な評価JSONを出した場合は、評価器異常ではなく実装不合格として扱う。評価出力の欠損・形式不正・起動失敗・timeoutだけを評価器異常にする。
- `execution_status`、`evaluation_status`、`outcome`を分離し、成功、実装不合格、Codex実行失敗、評価器異常を区別する。すべてのrunで`included_in_cost_analysis: true`を保持する。
- 人手入力は条件を含まないopaqueなreview ID、担当者、入力日時、修正分数、レビュー指摘を記録し、`conditionVisible: false`を必須とする。レビュー完了後にoperatorが対象runへ統合し、レビュー担当者へP0/P1/P2を露出しない。

```bash
pnpm experiment:evaluate-run \
  --asset-root /path/to/private-evaluation \
  --workspace /path/to/run-worktree \
  --diff /path/to/run/diff.patch \
  --run-json /path/to/run/run.json \
  --manifest /path/to/run/manifest.json \
  --human-review /path/to/run/human-review.json \
  --output /path/to/run/evaluated-run.json \
  --log /path/to/run/evaluation-log.json
```

---

## ISSUE-026: 集計・コスト計算・グラフ出力を実装する

状態: 実装済み（`scripts/aggregate-experiment-results.ts`）

- 種別: experiment
- 依存: ISSUE-024、ISSUE-025
- 目的: 粒度内でP0/P1/P2を比較できる集計を生成する。

### スコープ

- 中央値、最小、最大、四分位範囲
- トークン・クレジット・API単価相当額
- 成功率、成功1件当たりコスト
- タスク単位・粒度単位のCSV
- LT用グラフの元データ

### 受入条件

- G-A/G-B/G-Cの絶対値を優劣として直接比較しない。
- 料金表、通貨換算日、計算式を結果へ記録する。
- 成功数0件をゼロ除算せず明示する。
- rawデータから同じsummaryを再生成できる。

### 検証

- 手計算可能なfixtureで全指標を照合する。

### 実装メモ

- evaluated run JSONLと、確認日・出典・モデル別単価・為替観測日・人件費単価を持つpricing JSONを入力とする。料金をコードへ埋め込まない。
- 非キャッシュ入力、キャッシュ入力、出力からAPI単価相当額を算出し、reasoning outputは出力へ二重加算しない。人手修正費を加えた総コストも算出する。
- R-7方式で中央値、最小、最大、Q1、Q3、IQRを生成し、成功率、禁止変更数、評価器異常数、成功1件当たり指標を併記する。
- タスク×条件と粒度×条件だけを集計し、全粒度を混ぜたsummaryや絶対値ランキングを生成しない。成功0件では成功1件当たり値を`null`、理由を`no_successful_runs`とする。
- `summary.json`、cost付与済みJSONL、タスク別CSV、粒度別CSV、LTグラフ用long-format CSVを生成する。生成日時を含めず、同じrawとpricingからバイト単位で同一成果物を再生成できる。

```bash
pnpm experiment:aggregate \
  --runs /path/to/evaluated-runs.jsonl \
  --pricing /path/to/frozen-pricing.json \
  --output-dir /path/to/new-summary-directory
```

---

## ISSUE-027: パイロット実験を実施する

状態: 実行準備中（固定設定・45試行計画・成果物監査を実装済み）

- 種別: study
- 依存: ISSUE-026
- 目的: 本実験前にコスト、欠損、難易度、タイムアウトを確認する。

### スコープ

- G-A/G-B/G-C各1タスク
- P0/P1/P2
- 各5回
- 実行順ランダム化
- 欠損・外れ値・失敗理由レビュー

### 受入条件

- 45実行のrawデータと評価結果が保存されている。
- 粒度分類、予算、タイムアウトの妥当性を判断している。
- 本実験前の変更点を記録し、条件を再固定している。

### 検証

- raw件数、run ID重複、必須指標欠損を自動検査する。

### 実行メモ

- `experiment/pilot-config.json`へモデル、CLI、タイムアウト、予算、対象3タスク、Seed、開始コミット、非公開評価資産コミットを固定する。
- 同configへ公式Codexレートの確認日・出典と、非キャッシュ入力・キャッシュ入力・出力のcredits単価を固定する。parserは推論tokenを二重加算せず、各runのcreditsをtoken内訳から計算する。
- `pnpm experiment:pilot plan --output <outside-repo>/run-plan.json`で、反復ごとに3タスク×3条件をSeed付きで並べ替えた45試行を生成する。
- run成果物は公開リポジトリ外へ保存する。`pnpm experiment:pilot verify --plan <run-plan.json> --result-root <raw> --output <pilot-report.json>`で45件、run ID、raw・評価成果物、必須指標、固定モデル・reasoning・粒度別timeoutを検査する。
- credit値が全件0の場合は未計測として扱い、予算判断を成功扱いにしない。45件が揃った後も、粒度・timeout・予算の人間判断と、本実験向け条件の再固定記録がなければGo判定にしない。
- DBリセットは実験ランナーが作る使い捨てworktree内のSQLiteだけを対象とする。Prismaが要求する場合は、警告表示後に得たユーザーの明示的同意文を`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`へ渡す。

---

## ISSUE-028: LT用本実験を実施する

状態: 実行準備完了（90試行計画・再開・停止・逸脱記録・成果物監査を実装済み）

- 種別: study
- 依存: ISSUE-027
- 目的: 6タスク×3条件×5反復の比較データを取得する。

### スコープ

- GA-F1、GA-I1、GB-F1、GB-I1、GC-F1、GC-I1
- P0、P1、P2
- 各5回
- 固定したモデル・reasoning effort・CLI・sandbox

### 受入条件

- 90実行のrawデータ、作業ツリー、評価結果が揃っている。
- 条件逸脱、欠損、再実行の理由を記録している。
- タスク別と粒度別の集計を再生成できる。

### 検証

- 実験マトリクスの完全性と全成果物のハッシュを検査する。

### 実行メモ

- `experiment/main-config.json`へ6タスク、3条件、5反復、モデル、CLI、粒度別timeout、開始コミット、private evaluator commit、承認済み予算を固定する。
- `pnpm experiment:main plan --output <outside-repo>/run-plan.json`で決定論的な90試行計画を生成する。
- `run-all`は評価済みrunを保持して再開する。累計4,000 credits到達、1 runが200 credits超、評価器異常のいずれかで自動停止し、次run IDを返す。
- run開始・完了・再開・停止はJSONL event logへ追記する。条件逸脱または再実行を決定した場合は`record --event deviation|rerun --run-id <id> --reason <理由>`で理由とoperatorを先に記録する。
- `verify`は90件のrun identity、固定設定、worktree、必須raw・評価成果物を検査し、result root配下の全ファイルについてサイズとSHA-256を出力する。さらにタスク×条件18群（各5件）と粒度×条件9群（各10件）をrawから再集計する。
- DB resetは各run専用の使い捨てworktree内だけで実行し、開発用checkoutやパイロット成果物は変更しない。

---

## ISSUE-029: LT用レポートと再現手順を作成する

状態: 実装済み（Main v1実測レポート・固定ハッシュ付き再生成手順・データ辞書）

- 種別: documentation
- 依存: ISSUE-028
- 目的: 実測結果、限界、会社規模シナリオを再現可能な形で伝える。

### スコープ

- 粒度別P0/P1/P2比較
- 代表タスクの実行軌跡
- 成功1件当たりコスト
- 会社規模への換算3シナリオ
- 限界、再現手順、データ辞書

### 受入条件

- 仮説と実測結果を明確に分ける。
- 平均値だけで結論を出さない。
- 会社換算を予測ではなくシナリオとして表示する。
- 第三者がrawデータから主要表を再生成できる。

### 検証

- クリーン環境で集計再生成手順を実行し、公開表と一致することを確認する。

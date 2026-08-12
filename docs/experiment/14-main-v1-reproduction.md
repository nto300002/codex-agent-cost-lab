# Main v1 再現手順とデータ辞書

## 1. 対象

この手順は、公開リポジトリとは別に提供されるMain v1の90件のrawディレクトリから、LT用の主要表と集計成果物を再生成する。

非公開評価器、認証ファイル、実行worktreeは集計再生成には不要である。非公開評価資産を公開リポジトリへコピーしてはならない。

## 2. 入力

必要な入力は次の3点である。

1. このリポジトリのIssue #31対応commit
2. 監査済み`run-plan.json`
3. 90個の`<run-id>/evaluated-run.json`を含むrawディレクトリ

リポジトリ内の`experiment/main-pricing.json`を固定料金入力として使用する。

rawの想定構造:

```text
raw/
├── GA-F1-P0-run01/
│   └── evaluated-run.json
├── ...
└── GC-I1-P2-run05/
    └── evaluated-run.json
```

## 3. クリーン環境での再生成

Node.js 24系とpnpm 11.18.0を使用する。

```bash
git clone https://github.com/nto300002/codex-agent-cost-lab.git
cd codex-agent-cost-lab
pnpm install --frozen-lockfile

pnpm experiment:build-main-report \
  --plan /path/to/main-v1/run-plan.json \
  --result-root /path/to/main-v1/raw \
  --pricing experiment/main-pricing.json \
  --output-dir /tmp/main-v1-rebuilt
```

出力先は存在していないディレクトリを指定する。スクリプトはplanのsequence順に90件を収集し、run ID、task、conditionを照合してから集計する。欠損、重複、identity不一致があれば失敗する。

## 4. 出力

```text
/tmp/main-v1-rebuilt/
├── evaluated-runs.jsonl
├── public-summary.json
└── aggregation/
    ├── summary.json
    ├── costed-runs.jsonl
    ├── summary-by-task.csv
    ├── summary-by-granularity.csv
    └── chart-data.csv
```

同じraw、plan、pricingから生成したファイルは生成日時を含まず、バイト単位で一致する。

## 5. 公開表との照合

```bash
shasum -a 256 \
  /tmp/main-v1-rebuilt/evaluated-runs.jsonl \
  /tmp/main-v1-rebuilt/public-summary.json \
  /tmp/main-v1-rebuilt/aggregation/summary.json \
  /tmp/main-v1-rebuilt/aggregation/costed-runs.jsonl \
  /tmp/main-v1-rebuilt/aggregation/summary-by-task.csv \
  /tmp/main-v1-rebuilt/aggregation/summary-by-granularity.csv \
  /tmp/main-v1-rebuilt/aggregation/chart-data.csv
```

期待値:

| ファイル | SHA-256 |
|---|---|
| `evaluated-runs.jsonl` | `927562a0990c77c189c3385b215e8f49192770ba53c2d0124dc36b93524f4993` |
| `public-summary.json` | `81936751d800442cc291f1e5a261a6bc83ade5efae1aec7406a8541d886c381f` |
| `aggregation/summary.json` | `e13f1b0760c09746642be21bf0501f14a6e4bf5844e2462c7e8e7b9131a436b8` |
| `aggregation/costed-runs.jsonl` | `658cf311157c93969367ba5d914ac00d8e213271ff42c3a19837ebe22553fe99` |
| `aggregation/summary-by-task.csv` | `67d540a60ccf4b46fc9e9b93da2f2ab99e599c50157124aad81a8c00f2373e9e` |
| `aggregation/summary-by-granularity.csv` | `b7ad622630f8d5c2aa806df81305fa258901d4bdf82b52d1ff34b9e44595fef6` |
| `aggregation/chart-data.csv` | `3266173986cf0ad5e35192cbd4724111e6d457f7430e56a285cd75e31960cb23` |

`public-summary.json`内の論理サマリーSHA-256は`22fc9a5752222b632960e116c495299e90092347ad6c1580536779aa8c53e381`である。ファイルSHA-256とは、整形用空白を含めるかどうかが異なる。

ハッシュが一致しない場合は、次を確認する。

- rawがMain v1の90件であるか
- 中断して保全した未完了runをrawへ混ぜていないか
- `run-plan.json`と`experiment/main-pricing.json`を変更していないか
- Node.jsとpnpmの固定バージョンを使用しているか
- 集計コードのcommitが一致しているか

## 6. 計算規則

### credits

```text
uncached_input_tokens = input_tokens - cached_input_tokens

credits =
  uncached_input_tokens / 1,000,000 × uncached input rate
  + cached_input_tokens / 1,000,000 × cached input rate
  + output_tokens / 1,000,000 × output rate
```

`reasoning_output_tokens`は`output_tokens`に含まれるため再加算しない。

### 成功1件当たりcredits

```text
群に含まれる全runのcredits合計 / 成功run数
```

失敗runも分子へ含める。成功数0の場合は`null`とし、ゼロ除算しない。

### 分布

- 最小、Q1、中央値、Q3、最大、IQRを出力する。
- 四分位数はR-7線形補間を使用する。
- 比較はG-A、G-B、G-Cそれぞれの内側で行う。
- 全粒度を混ぜた絶対値ランキングは生成しない。

## 7. evaluated runデータ辞書

### 識別・固定条件

| フィールド | 型 | 定義 |
|---|---|---|
| `run_id` | string | `<task>-<condition>-runNN`形式の一意ID |
| `task_id` | enum | GA-F1、GA-I1、GB-F1、GB-I1、GC-F1、GC-I1 |
| `granularity` | enum | G-A、G-B、G-C |
| `prompt_condition` | enum | P0、P1、P2 |
| `model` | string | 固定したCodexモデル |

### token・実行量

| フィールド | 型 | 定義 |
|---|---|---|
| `input_tokens` | integer | Codex JSONLが報告した総入力token |
| `cached_input_tokens` | integer | 入力tokenのうちキャッシュされた部分 |
| `uncached_input_tokens` | integer | `input - cached input` |
| `output_tokens` | integer | 課金対象の出力token。推論分を含む |
| `reasoning_output_tokens` | integer | 出力の内訳として報告された推論token |
| `credits` | number | 固定レートから再計算した消費credits |
| `duration_seconds` | number | Codex実行時間。準備と評価を含まない |

### 探索・変更

| フィールド | 型 | 定義 |
|---|---|---|
| `command_count` | integer | JSONL上で一意化したコマンド数 |
| `explicit_file_references_unique` | integer | ログ上で明示的に参照された一意ファイル数 |
| `repository_wide_searches` | integer | `rg`、`find`などの横断検索数 |
| `test_runs_total` | integer | 検出されたテストコマンド数 |
| `changed_files` | integer | unified diff上の変更ファイル数 |
| `lines_added` | integer | unified diff上の追加行数 |
| `lines_deleted` | integer | unified diff上の削除行数 |

`explicit_file_references_unique`は全ファイル閲覧数ではない。JSONLから観測できた参照だけを表す。

### 品質・採否

| フィールド | 型 | 定義 |
|---|---|---|
| `success` | boolean | 固定した外部評価の必須条件をすべて満たしたか |
| `quality_score` | number | 0〜100の補助品質点 |
| `forbidden_change` | boolean | 禁止領域を変更したか |
| `evaluation_status` | enum | `completed`または評価器自体の`error` |
| `outcome` | enum | success、implementation_failure、execution_failure、evaluator_failure |
| `included_in_cost_analysis` | boolean | コスト分析へ含めるか。実装失敗も原則true |

### 人手評価・コスト

| フィールド | 型 | 定義 |
|---|---|---|
| `human_fix_minutes` | number | blind reviewで記録した追加修正時間。本実験では0 |
| `api_equivalent_usd` | number | 固定料金表によるAPI相当額 |
| `api_equivalent_jpy` | number | 固定換算レートによる参考円換算 |
| `human_cost_jpy` | number | 修正時間×固定会社負担単価 |
| `total_cost_jpy` | number | API相当円換算と人件費の合計 |

円換算は実支払額ではない。Main v1の150円/USDは固定シナリオ値である。

## 8. 成果物の読み方

- `public-summary.json`: LT本文で使用した粒度別、タスク別、代表run、会社シナリオの固定値
- `summary.json`: 全集計、料金入力、式、全costed run
- `summary-by-task.csv`: 6タスク×3条件のlong-format集計
- `summary-by-granularity.csv`: 3粒度×3条件のlong-format集計
- `chart-data.csv`: LTグラフ作成用の主要指標
- `costed-runs.jsonl`: 90件の評価済みrunへ換算額を付加したデータ

実測結果の解釈は[Main v1 実測結果とLT向け結論](13-main-v1-results.md)を参照する。

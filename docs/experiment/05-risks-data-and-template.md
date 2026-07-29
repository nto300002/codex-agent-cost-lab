# リスク・データ・タスクテンプレート

## 18. バイアスと限界

### 18.1 タスク難易度の不均衡

同じ粒度でもタスク固有の難しさが異なる。

対策:

- 複数タスクを使う
- 事前の正解実装で分類する
- タスク単位の結果も掲載する

### 18.2 正解情報の混入

P1だけに正解ファイルや原因を与えると公平でない。

対策:

- 本質的な事実量をそろえる
- 追加するのは構造、範囲、制約、終了条件を中心にする

### 18.3 キャッシュ

同じ固定コンテキストや似たプロンプトはキャッシュされる可能性がある。

対策:

- `cached_input_tokens`を別集計する
- 実行順をランダム化する
- 非キャッシュ入力と実消費クレジットの両方を表示する
- キャッシュ込みの実運用結果として解釈する

### 18.4 モデル更新

実験期間中にモデルまたはCodex CLIが更新される可能性がある。

対策:

- 実験期間を短くする
- CLIバージョンを固定する
- モデル名と実行日時を保存する

### 18.5 ファイル参照の測定

JSONLだけでは、Codexが内部的に扱った全ファイルを完全に把握できない場合がある。

対策:

- 「明示的に参照されたファイル」と定義する
- 横断検索回数を別指標にする
- ファイル変更数も併記する

### 18.6 LT向け実験の一般化

一つのリポジトリで得た結果を、すべてのシステム会社へ一般化できない。

発表では次のように表現する。

> この環境ではこの差が出た。自社のリポジトリとタスクで測定する必要がある。

---

## 19. 出力データ形式

各実行を1行にまとめる。

```json
{
  "run_id": "GB-I1-P2-run03",
  "task_id": "GB-I1",
  "granularity": "G-B",
  "task_type": "implementation",
  "prompt_condition": "P2",
  "codex_cli_version": "",
  "model": "",
  "reasoning_effort": "",
  "input_tokens": 0,
  "cached_input_tokens": 0,
  "uncached_input_tokens": 0,
  "output_tokens": 0,
  "reasoning_output_tokens": 0,
  "credits": 0,
  "duration_seconds": 0,
  "command_count": 0,
  "explicit_file_references_total": 0,
  "explicit_file_references_unique": 0,
  "duplicate_file_references": 0,
  "repository_wide_searches": 0,
  "test_runs_total": 0,
  "full_test_runs": 0,
  "changed_files": 0,
  "lines_added": 0,
  "lines_deleted": 0,
  "success": false,
  "quality_score": 0,
  "forbidden_change": false,
  "human_fix_minutes": 0
}
```

---

## 20. ディレクトリ構成

```text
codex-cost-experiment/
├── README.md
├── EXPERIMENT_REQUIREMENTS.md
├── base-repo/
├── tasks/
│   ├── GA-F1.md
│   ├── GA-I1.md
│   ├── GB-F1.md
│   ├── GB-I1.md
│   ├── GC-F1.md
│   └── GC-I1.md
├── prompts/
│   ├── P0/
│   ├── P1/
│   └── P2/
├── agents/
│   ├── minimal-AGENTS.md
│   └── verbose-AGENTS.md
├── hidden-evaluation/
├── scripts/
│   ├── run-experiment.sh
│   ├── evaluate.sh
│   ├── parse-codex-jsonl.py
│   └── aggregate-results.py
├── workspaces/
└── results/
    ├── raw/
    ├── evaluations/
    ├── summary.csv
    └── charts/
```

---

## 21. タスク定義テンプレート

```markdown
# Task ID

## Metadata

- Granularity:
- Type: implementation | fix
- Starting commit:
- Target module:
- Reference patch files:
- Reference patch lines:
- Estimated human time:

## User-visible request

## Reproduction steps

## Acceptance criteria

## Constraints

## Hidden evaluation

## Forbidden changes

## Expected relevant files

## Notes for experiment operator
```

`Expected relevant files`と`Hidden evaluation`はCodexへ渡さない。

---

# Documentation

このディレクトリには、Codexコスト比較実験の背景、実験設計、実験対象アプリ TraceCRM の要件を、更新・レビューしやすい単位で収録しています。

## 推奨する読む順番

1. [LTの文脈と実験の動機](background/01-lt-context-and-motivation.md)
2. [実験の目的・リサーチクエスチョン・仮説](experiment/01-purpose-and-hypotheses.md)
3. [タスク粒度とプロンプト条件](experiment/02-task-and-prompt-design.md)
4. [TraceCRMの概要とアーキテクチャ](trace-crm/01-overview-and-architecture.md)
5. [実行設計](experiment/03-execution-design.md)
6. [測定・評価方法](experiment/04-metrics-and-evaluation.md)

## 背景・LT

| 文書 | 内容 |
|---|---|
| [LTの文脈と実験の動機](background/01-lt-context-and-motivation.md) | 発表の問い、実験の必要性、比較条件、対象者 |
| [コストと成功指標](background/02-cost-and-success-metrics.md) | トークン、クレジット、成功1件当たりコストの計算 |
| [想定結果と発表設計](background/03-results-and-presentation.md) | 結果パターン、見せ方、限界、発表の着地点 |

## 比較実験

| 文書 | 内容 |
|---|---|
| [目的と仮説](experiment/01-purpose-and-hypotheses.md) | 目的、設計判断、RQ、仮説、対象環境 |
| [タスクとプロンプトの設計](experiment/02-task-and-prompt-design.md) | タスク粒度、タスク構成、P0〜P3 |
| [実行設計](experiment/03-execution-design.md) | 完全交差、反復、固定条件、1実行の手順 |
| [測定と評価](experiment/04-metrics-and-evaluation.md) | 指標、成功判定、人手評価、集計、判断基準 |
| [リスク・データ・テンプレート](experiment/05-risks-data-and-template.md) | バイアス、出力形式、ディレクトリ、タスク定義 |
| [実施フェーズと報告](experiment/06-phases-and-reporting.md) | パイロット、本実験、LT表示、実施可否 |
| [実験計画](experiment/07-experiment-plan.md) | 実験マトリクス、実行手順、停止条件、分析、成果物 |
| [基準状態と隔離](experiment/08-baseline-and-isolation.md) | 基準検証、禁止変更、マニフェスト、隠し評価資産の境界 |

## TraceCRM

| 文書 | 内容 |
|---|---|
| [概要とアーキテクチャ](trace-crm/01-overview-and-architecture.md) | 目的、技術、構成、層の責務 |
| [ドメインと認可](trace-crm/02-domain-and-authorization.md) | データモデル、認証、ロール別権限 |
| [機能要件](trace-crm/03-functional-requirements.md) | 各機能、API、UI、共通ルール、Seed |
| [テストと非機能要件](trace-crm/04-testing-and-nonfunctional.md) | テスト戦略、再現性、品質、性能 |
| [実験タスクと境界](trace-crm/05-experiment-tasks-and-boundaries.md) | タスク作成要件、具体タスク、ハーネス境界 |
| [実装・完成計画](trace-crm/06-delivery-plan.md) | 実装順序、完成条件、MVP外、設計判断 |

## 実装Issue

実装順序、依存関係、受入条件を含むIssueバックログは [Issueバックログ](issues/README.md) を参照してください。

6件の比較タスク定義と公開・operator情報の境界は [Experiment task definitions](../experiment/tasks/README.md) を参照してください。

## 設計判断

| ADR | 内容 |
|---|---|
| [ADR-0001](decisions/0001-tracecrm-technology-baseline.md) | TraceCRMの技術、認証、削除、監査、E2E、実験上限、Codex条件 |

## 文書情報

- 原資料作成日: 2026-07-28
- 文書バージョン: 0.1
- 対象: Codex CLIを用いた再現可能な比較実験
- 実験用アプリ仮称: TraceCRM

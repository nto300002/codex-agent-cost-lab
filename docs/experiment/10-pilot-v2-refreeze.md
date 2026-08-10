# Pilot v2 条件再固定

- 固定日: 2026-08-10
- 設定: `experiment/pilot-config-v2.json`
- バージョン: `pilot-v2`
- Seed: `pilot-2026-08-10-v2`
- 非公開評価資産commit: `1fa50f2ea36511a9ac98ecf4f058729016e3da21`

## Pilot v1からの変更

Pilot v1のNo-Go原因だけを修正し、モデル、reasoning effort、CLI、開始commit、プロンプト、反復数、timeout、料金レート、予算停止条件は変更しない。

1. GB-I1のOwner query検査が、直接記述したZod schemaと既存の同等validatorを再利用したschemaの両方を受理するようにした。
2. GB-I1の評価上の変更ファイル許容数を8件から9件へ変更した。タスク粒度の「主な関連ファイル4〜8件」は維持し、受入条件に従った追加テスト1件を評価上の失敗にしない。
3. 評価器検証へGB-I1の同等別実装を追加した。

## 再検証

Node.js 24を固定し、全6タスクで次を確認した。

- 正解実装: 100点
- 未変更: 不合格
- 意図的誤答: 不合格
- GB-I1の同等別実装: 100点

## 実行条件

| 項目 | 固定値 |
|---|---|
| 試行数 | 45 |
| モデル | gpt-5.6-sol |
| reasoning effort | medium |
| 累計上限 | 5,000 credits |
| 累計停止・レビュー | 4,000 credits |
| 1run停止・レビュー | 200 credits超 |
| G-A timeout | 15分 |
| G-B timeout | 30分 |
| G-C timeout | 60分 |

Pilot v2の成果物はPilot v1と分離し、Pilot v1を本実験の主要効果集計へ含めない。

# 実施フェーズと報告

## 22. 実施フェーズ

### Phase 1: 計測基盤の確認

- 単一のG-AタスクでJSONLを取得する
- トークンを抽出する
- クレジットを算出する
- コマンドを抽出する
- 隠しテストで成功判定する

### Phase 2: パイロット

- G-A、G-B、G-Cを各1タスク
- P0、P1、P2
- 各5回

目的:

- コスト規模を確認する
- タイムアウトを調整する
- 粒度分類が適切か確認する
- 指標の欠損を確認する

### Phase 3: LT用本実験

- 各粒度に実装1件・修正1件
- P0、P1、P2
- 各5回
- 結果を中央値、範囲、成功率で比較する

### Phase 4: 任意の追加実験

- 過剰な `AGENTS.md` のP3
- モデル差
- reasoning effort差
- 小型モデルとのルーティング
- キャッシュの影響
- サブエージェント有無

Phase 4は本実験へ混ぜず、別実験として扱う。

---

## 23. LTでの最終的な表示

### 表1: 粒度別の結果

| 粒度 | 条件 | 成功率 | 中央クレジット | ユニーク参照 | テスト回数 |
|---|---|---:|---:|---:|---:|
| G-A | P0 |  |  |  |  |
| G-A | P1 |  |  |  |  |
| G-A | P2 |  |  |  |  |
| G-B | P0 |  |  |  |  |
| G-B | P1 |  |  |  |  |
| G-B | P2 |  |  |  |  |
| G-C | P0 |  |  |  |  |
| G-C | P1 |  |  |  |  |
| G-C | P2 |  |  |  |  |

### 表2: 成功1件当たりコスト

| 条件 | 全実行クレジット | 成功数 | 成功1件当たり |
|---|---:|---:|---:|
| P0 |  |  |  |
| P1 |  |  |  |
| P2 |  |  |  |

### LTでの着地

> 適当なプロンプトが常に高いわけではない。
> しかし、探索範囲と終了条件が曖昧なタスクでは、1回当たりの小さな寄り道が、組織全体の継続的なコストになる。

---

## 24. 実施可否の結論

タスク粒度をG-A、G-B、G-Cに分け、各粒度で似た性質の実装・修正タスクを複数実施する方針は妥当である。

ただし、次の条件を守る。

1. タスク粒度とプロンプト条件を別軸にする
2. 各タスクを全プロンプト条件で実行する
3. 各粒度に実装タスクと修正タスクを含める
4. 変更行数だけで粒度を決めない
5. 1条件1回で結論を出さない
6. 成功率と成功1件当たりコストを主要指標にする
7. G-A、G-B、G-Cを直接比較するのではなく、各粒度内でP0、P1、P2を比較する
8. 同じタスクの名前だけを変えた複製を使わない
9. 正解実装と隠しテストを事前に用意する
10. 実験結果を全企業へ一般化しない

---

## 25. 根拠となる資料

1. OpenAI, **Codex Non-interactive mode**
   `codex exec --json`は、ターン、コマンド実行、ファイル変更、完了時のトークン使用量等をJSONLで出力する。
   https://developers.openai.com/codex/noninteractive

2. OpenAI, **Codex Advanced Configuration**
   CodexはOpenTelemetryによるAPIリクエスト、イベント、ツール結果等の観測に対応している。
   https://developers.openai.com/codex/config-advanced

3. OpenAI, **Custom instructions with AGENTS.md**
   Codexは実行開始時にグローバルおよびプロジェクト階層の `AGENTS.md` を読み込み、階層順に指示を結合する。
   https://developers.openai.com/codex/guides/agents-md

4. OpenAI, **Codex rate card**
   Codexのクレジット消費は、適用対象プランでは入力、キャッシュ入力、出力トークン別のレートに基づく。
   https://help.openai.com/en/articles/20001106-codex-rate-card

5. Bai et al., **How Do AI Agents Spend Your Money? Analyzing and Predicting Token Consumption in Agentic Coding Tasks**, 2026
   同一タスクでもトークン消費が大きく変動し、消費量の増加が成功率向上へ単純には結び付かないことを報告。
   https://arxiv.org/abs/2604.22750

6. Lulla et al., **On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents**, 2026
   10リポジトリ・124 PRの比較で、`AGENTS.md`あり条件の実行時間と出力トークンの減少を報告。
   https://arxiv.org/abs/2601.20404

7. Gloaguen et al., **Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?**, 2026
   不要なリポジトリ指示が探索と推論費用を増やし、成功率を低下させる可能性を報告。
   https://arxiv.org/abs/2602.11988

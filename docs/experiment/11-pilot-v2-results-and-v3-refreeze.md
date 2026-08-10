# Pilot v2結果とPilot v3再固定

- Pilot v2実施日: 2026-08-10
- Pilot v2設定SHA-256: `6e08f0c0eb42c29a62461b6bc389b660f76cd323b89e9001fb9bee737e965b76`
- Pilot v2計画SHA-256: `c5c31a776a0f590d7f1c611db920081f5bc5fad24ec3c0d9cdba62ed2ee47b05`
- 判定: **No-Go**

## 1. 完全性と予算

| 検査 | 結果 |
|---|---:|
| 完了run | 45/45 |
| raw JSONL | 45 |
| 評価結果 | 45 |
| 必須成果物欠損 | 0 |
| run ID重複 | 0 |
| 評価器実行エラー | 0 |
| タイムアウト | 0 |
| 累計credits | 782.1738 |
| 最大credits/run | 31.5062 |

予算、timeout、タスク粒度は妥当と判断した。credits、実行時間、入力token、出力token、変更ファイル数にIQR外れ値はなかった。

## 2. 記録された結果

| 集計 | 成功 | credits | 成功1件当たりcredits |
|---|---:|---:|---:|
| GA-F1 | 15/15 | 155.441375 | 10.362758 |
| GB-I1 | 7/15 | 389.982500 | 55.711786 |
| GC-F1 | 15/15 | 236.749925 | 15.783328 |
| P0 | 11/15 | 249.454525 | 22.677684 |
| P1 | 12/15 | 269.938375 | 22.494865 |
| P2 | 14/15 | 262.780900 | 18.770064 |

この表は評価器監査前の記録値であり、効果比較には使用しない。

## 3. 失敗8件の監査

記録上の失敗8件はすべてGB-I1だった。全件について次を確認した。

- Customer検索schemaにOwner queryが存在する。
- Status、永続化、UI controlの隠し検査は合格している。
- 公開回帰テスト、変更範囲、禁止変更検査は合格している。
- 修正後の隠し評価は合格する。

実装は `optionalOwnerId`、`optionalSearchOwnerId`、`ownerId.optional()` などの有効なvalidator表現を使用していた。Pilot v2評価器が一部の変数名・構文だけを許容したことが偽陰性の原因である。

成功判定を事後に書き換えず、Pilot v2を評価器不安定によるNo-Goとして保持する。

## 4. Pilot v3の再固定

- 設定: `experiment/pilot-config-v3.json`
- Seed: `pilot-2026-08-10-v3`
- 非公開評価資産commit: `9bd661b3d7ea4f094905340a2140e3ee6594012f`
- 設定ファイルSHA-256: `03616fb7f26d035091b7e3eb24973c394da7f3c6b618c9538f8bd1fd235ce09c`
- 45run計画ファイルSHA-256: `cb0ed87d55f755f395987386443e98b396f8f21caeec8580b194dbf7782f6409`

Pilot v2から変更するのは評価器commitとランダム化Seedだけである。GB-I1のStatus・Owner query検査をCustomer検索schemaのプロパティ有無で判定し、validatorの変数名や直接記述に依存させない。

全6タスクで正解、未変更、意図的誤答を再検証し、GB-I1では複数の同等validator表現も100点になることを確認した。Pilot v2で偽陰性となった8worktreeも修正後の隠し評価を通過した。

Pilot v3の新規45runは、追加の認証済みモデル実行と予算承認を確認してから開始する。

## 5. 保存先

Pilot v2のraw、評価、計画、初回レポート、失敗監査、統計は次の非公開ディレクトリへ保存した。

```text
/Users/naotoyasuda/Documents/codex-agent-cost-lab-results/pilot-v2
```

rawと評価は各45件で、コピー元との全ファイル比較および主要成果物のSHA-256一致を確認済みである。

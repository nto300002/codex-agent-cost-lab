# Experiment task definitions

このディレクトリは6件の実験タスクを、Codexへ渡す情報とオペレーター専用情報に分けて管理する。

## 情報境界

- `public/*.md`: Codexへ渡してよい依頼、受入条件、制約、公開検証コマンド
- `operator/*.json`: 再現手順、想定関連ファイル、粒度根拠、禁止変更、人間の標準作業時間、共通開始コミット

実験ランナーは`public`の対象ファイルだけをプロンプト構築へ使用する。`operator`はCodexのsandbox rootへコピーせず、実験オペレーターと評価器だけが読む。正解パッチと隠しテストはこのディレクトリへ置かず、リポジトリ外のハーネスで管理する。

## 独立性

6タスクはすべてoperator定義の同一`startingCommit`から新しいworkspaceを作る。タスクのsetup patchは非公開評価リポジトリから各runへ単独適用する。別タスクや前回runの差分を累積しない。`GC-I1`は共通開始コミット自体が未実装状態なのでsetup patchを持たない。

`git reset --hard`は、実験ランナーがrunごとに作成した使い捨てworkspaceだけで実行する。開発者の通常workspaceには使用しない。

非公開資産の内容は公開側へ置かず、`experiment/task-assets.lock.json`に評価リポジトリのコミットと各資産のSHA-256だけを保持する。

## 静的検査

```bash
pnpm experiment:validate-tasks
```

検査対象:

- GA、GB、GCそれぞれにfixとimplementationが1件ずつある
- 全タスクが同じ40桁の開始コミットを参照する
- 粒度ごとの関連ファイル数、層数、人間時間の範囲
- 再現手順、受入条件数、禁止変更、検証コマンド
- 公開Briefにoperator専用フィールドが混入していない

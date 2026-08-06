# AGENTS conditions

実験条件ごとの`AGENTS.md`状態を固定する。テンプレートは実験リポジトリ直下へ常設せず、runごとの隔離workspaceへ開始直前に配置する。

| 条件 | workspace直下の状態                         | 用途                     |
| ---- | ------------------------------------------- | ------------------------ |
| P0   | `AGENTS.md`、`AGENTS.override.md`ともに不在 | 通常の短い依頼           |
| P1   | `AGENTS.md`、`AGENTS.override.md`ともに不在 | 構造化プロンプトのみ     |
| P2   | `minimal-AGENTS.md`と同一内容の`AGENTS.md`  | 最小リポジトリ指示       |
| P3   | `verbose-AGENTS.md`と同一内容の`AGENTS.md`  | 任意の過剰指示・負の対照 |

P3は主実験には含めず、追加実験を明示的に実施する場合だけ使用する。

## 配置と検査

専用の実験`CODEX_HOME`と、workspace外の記録先を必ず指定する。

```bash
pnpm experiment:configure-agents -- \
  --condition P2 \
  --workspace /path/to/isolated-workspace \
  --codex-home /path/to/experiment-codex-home \
  --record /path/to/results/run-id/agent-condition.json \
  --apply
```

配置後の再検査では`--apply`を外す。P0/P1は既存のプロジェクト指示を撤去し、P2/P3は固定テンプレートを配置する。すべての条件で次を検査する。

- workspace直下の`AGENTS.override.md`が存在しない。
- 親ディレクトリと専用`CODEX_HOME`に`AGENTS.md`または`AGENTS.override.md`が存在しない。
- P2/P3の内容がmanifestのSHA-256と一致する。
- 条件適用前後のSHA-256または不在状態をworkspace外のJSONへ記録する。

テンプレート自体の静的検査:

```bash
pnpm experiment:validate-agents
```

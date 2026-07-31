# ADR-0001: TraceCRM技術ベースライン

- 状態: Accepted
- 決定日: 2026-07-31
- 更新日: 2026-08-01
- 対象Issue: ISSUE-001
- 適用範囲: TraceCRM基準実装、パイロット、本実験

## 1. 背景

TraceCRMは本番CRMではなく、Codexのプロンプト条件による探索、トークン、コスト、成功率の差を測る実験用アプリである。

技術選択では、最新機能の採用数より次を優先する。

1. 同じGitコミットから同じ状態を再現できる。
2. CodexがUI、API、application、domain、infrastructureを探索する余地がある。
3. 外部サービス、暗黙のコード生成、環境差を減らす。
4. 局所、複数層、横断タスクを自然に作れる。
5. テスト対象と成功判定を機械的に分離できる。

## 2. 決定

### 2.1 バージョン

2026-07-31時点の固定候補を次とする。Issue 2で初期化した時点のlockfileを基準とし、パイロット完了まで更新しない。

| 項目 | 固定バージョン | 理由 |
|---|---:|---|
| Node.js | 24.18.0 | Active LTS、Prisma 7とpnpm 11の要件を満たす |
| pnpm | 11.18.0 | `packageManager` とセットアップ手順で固定する |
| Next.js | 16.2.12 | 16.2系のセキュリティ修正版以降にある現行patch |
| React / React DOM | 19.2.8 | Next.js 16.2の対応範囲内で同一版に固定する |
| TypeScript | 5.9.3 | Prisma 7の推奨系に合わせ、TS 7移行ノイズを避ける |
| Prisma / Prisma Client | 7.9.1 | 同一バージョンへ揃える |
| Prisma SQLite adapter | 7.9.1 | `@prisma/adapter-better-sqlite3` を使用する |
| Zod | 4.4.3 | API境界の入力検証に限定する |
| Vitest | 4.1.10 | 単体・結合テスト |
| Playwright | 1.62.1 | 対象を限定したE2Eテスト |
| ESLint | 9.39.5 | `eslint-config-next` 16.2.12のReactルールと実動作を確認した版 |
| Prettier | 3.9.6 | 書式のみを担当させる |
| tsx | 4.23.1 | SeedとローカルスクリプトのTypeScript実行 |

補助型は `@types/node` 24.13.3、`@types/react` 19.2.18、`@types/react-dom` 19.2.4、`@types/better-sqlite3` 7.6.13を初期候補とする。

`package.json` では範囲指定を使わず完全一致で保存し、`pnpm-lock.yaml` をコミットする。依存の更新は基準コミットを作る前だけ許可する。

ESLint 10.8.0は `eslint-config-next` のpeer範囲を満たすが、内包される `eslint-plugin-react` 7.37.5がESLint 10のcontext APIへ未対応でlint実行に失敗したため、Issue 2の実動作検証で9.39.5へ変更した。

### 2.2 アプリケーション構成

- 単一のNext.js App Routerアプリとする。
- React Server Componentsを既定とし、状態やブラウザAPIが必要なフォームだけClient Componentにする。
- HTTP APIはNext.js Route Handlersへ統一し、Server Actionsは使用しない。
- Route Handlerは認証、入力変換、use case呼び出し、HTTP変換だけを担当する。
- application層がuse caseとトランザクション境界を持つ。
- domain層は業務ルールと認可判断を持ち、Next.jsとPrismaへ依存しない。
- infrastructure層はPrisma、Cookie、CSV等の実装を持つ。
- Next.jsのexperimental flag、Edge runtime、外部キャッシュを使用しない。

Server Actionsを避ける理由は、APIとUIの境界、認可、入力検証、コマンド実行をログとテストから明示的に観測できるようにするためである。

### 2.3 ESMとSQLite

- `package.json` に `"type": "module"` を設定する。
- Prisma 7の `prisma-client` generatorを使用し、生成先を明示する。
- SQLite接続は `@prisma/adapter-better-sqlite3` を使用する。
- pnpmが実行を許可するnative buildは `better-sqlite3` だけに限定する。
- DateTimeはadapter既定のISO 8601形式で保存し、アプリ内ではUTCとして扱う。
- 実験は単一プロセス・単一writerを基本とし、WALや並列DB更新を前提にしない。
- DBファイル、journal、テストDBはrunごとに新規生成し、次の反復へ再利用しない。

### 2.4 CSS

CSS Modulesを採用する。Tailwind CSSは採用しない。

理由:

- CSS framework固有の探索範囲と生成クラスを増やさない。
- UI変更をcomponentと同階層のmoduleへ局所化できる。
- 依存とビルド設定を減らせる。
- LTの主題ではないデザインシステム構築を避けられる。

### 2.5 認証とセッション

DB管理の不透明セッションを採用し、署名付き自己完結Cookieや外部認証ライブラリは使用しない。

- ログイン時に `crypto.randomBytes(32)` でセッショントークンを生成する。
- ブラウザCookieには生トークンだけを保存する。
- DBにはSHA-256でハッシュ化したトークンだけを保存する。
- Cookie名は `tracecrm_session` とする。
- Cookie属性は `HttpOnly`、`SameSite=Lax`、`Path=/`、本番相当時は `Secure` とする。
- セッション有効期限は発行から8時間の固定期限とし、sliding expirationは使用しない。
- ログアウト、ユーザー無効化、パスワード変更時に対象セッションを削除する。
- パスワードはNode.js標準の `crypto.scrypt`、ユーザーごとのsalt、version付き文字列表現で保存する。

Sessionモデル:

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| tokenHash | String | 必須、一意 |
| userId | String | User参照 |
| expiresAt | DateTime | 必須 |
| createdAt | DateTime | 自動 |

この方式は失効を即時反映でき、時刻境界、DB参照、Cookie処理のテストを明示的に作れる。

### 2.6 Customer削除

Customerは物理削除する。削除はapplication層の1トランザクションで、次の順に明示的に行う。

1. 削除前データと関連件数を取得する。
2. CustomerTagを削除する。
3. Activityを削除する。
4. Dealを削除する。
5. Customerを削除する。
6. Customer DELETEのAuditLogを1件記録する。

暗黙のDB cascadeだけへ依存しない。これによりGC-F1で、application層のトランザクション、関連削除、監査記録を横断的に評価できる。

AuditLogの `entityId` は業務エンティティへの外部キーにせず、削除後も識別子を保持する。

### 2.7 AuditLogの基準範囲

基準実装ではAuditLogの共通基盤、閲覧画面、次の記録を完成させる。

- LOGIN、LOGOUT
- UserのCREATE、UPDATE、DISABLE、ROLE_CHANGE
- CSV EXPORT
- Customer DELETE

GC-I1では、既存基盤を使って次へ適用範囲を拡張する。

- Customer CREATE / UPDATE
- Deal CREATE / UPDATE / DELETE
- Activity CREATE / UPDATE / DELETE

GC-I1はAuditLog基盤そのものの新規設計ではなく、複数機能へ一貫して適用する横断タスクとする。

### 2.8 E2Eの使用範囲

- 基準コミットでは主要フローのsmoke E2Eをすべて成功させる。
- G-Aの各run後評価ではE2Eを実行せず、対象単体・結合テストを使用する。
- G-Bではタスク固有の対象E2Eだけを成功判定へ含める。
- G-Cではタスク固有E2Eと主要回帰smokeを成功判定へ含める。
- 全E2Eは基準検証と本実験終了後の回帰確認で実行する。

各runで全E2Eを実行しないことで、タスク粒度とは無関係な固定コストを抑え、Codex自身が選んだテスト回数との混同を避ける。

### 2.9 人間の標準作業時間

- 同一の熟練フルスタックエンジニア1名が全6タスクを担当する。
- 担当者名はパイロット前のexperiment manifestへ記録する。
- 正解パッチ作成時にactive working timeを1分単位で計測する。
- 仕様読解、実装、公開テストを含め、休憩と環境構築待ちは除外する。
- Codex結果の人間レビューでは条件名を伏せ、同じ担当者・同じrubricを使用する。

担当者を途中で変更した場合、変更前後の時間を同じ母集団として集計しない。

### 2.10 G-Cの上限

- G-A 1runのwall-clock timeout: 15分
- G-B 1runのwall-clock timeout: 30分
- G-C 1runのwall-clock timeout: 60分
- 1runのクレジット警戒上限: 200 credits
- パイロット全体の上限: 5,000 credits
- 本実験全体の上限: 10,000 credits
- 消費が各フェーズ上限の80%へ達した時点で、残試行の完了見込みを再計算する。

200 creditsは、GPT-5.6 Solの現行レートを使い、非キャッシュ入力100万tokenと出力10万tokenに相当する警戒値である。実行中の強制token停止機能としては扱わず、超過runを保持したうえで次のrunを開始しない。

予算不足の場合は反復数を1回へ減らさず、追加タスクまたはP3を取りやめる。

### 2.11 Codex条件

- Codex CLI: 0.144.4
- モデル: `gpt-5.6-sol`
- reasoning effort: medium
- speed tier / Fast mode: 使用しない
- subagent / Ultra: 使用しない
- sandbox: workspace-write
- approval policy: never
- network: 無効
- MCP、Skill、memory: 実験に不要なものは無効
- 実行方式: `codex exec --json --ephemeral`
- 実験専用 `CODEX_HOME` を使用する。

実験用 `config.toml` では少なくとも次を明示する。

```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"
approval_policy = "never"

[sandbox_workspace_write]
network_access = false

[features]
fast_mode = false
multi_agent = false
memories = false
```

Sol/mediumは公式の標準開始点であり、実験では品質・速度・コストの比較軸をプロンプト条件だけに限定する。モデル、reasoning effort、speed tier、サブエージェントは主実験中に変更しない。

## 3. 推奨実装パターン

```text
Route Handler / Server Component
        │
        ▼
presentation adapter
  - HTTP/Cookie変換
  - Zod validation
        │
        ▼
application use case
  - transaction boundary
  - authorization orchestration
        │
        ▼
domain
  - entity/value/rule/policy
        │
        ▼
infrastructure
  - Prisma repository
  - session store
  - CSV/AuditLog adapter
```

依存方向はpresentation → application → domainとし、infrastructureはapplicationが定義するportを実装する。小規模実験アプリのためDI containerは導入せず、factory関数で依存を組み立てる。

## 4. 採用しない案

| 案 | 不採用理由 |
|---|---|
| Tailwind CSS | UI実験ではなく、クラス探索と設定依存を増やす |
| Server Actions中心 | HTTP/API境界と認可の観測が不明瞭になる |
| Auth.js等の認証framework | 外部仕様とadapter層が実験ノイズになる |
| JWT自己完結セッション | 即時失効とDB状態の評価が複雑になる |
| 論理削除 | 全queryへ暗黙条件が増え、GC-F1以外にも影響する |
| DB cascadeだけの関連削除 | 横断タスクのapplication整合性を評価しにくい |
| Edge runtime | Prisma SQLite native adapterと整合しない |
| Monorepo / DI container | セットアップと探索ノイズが増える |
| Next.js experimental機能 | 実験期間中の挙動変化リスクが高い |
| 全runで全E2E | 固定コストが大きく、タスク粒度の差を隠す |

## 5. 固定時点と変更管理

1. Issue 2完了時にruntimeと依存lockfileを固定する。
2. Issue 17完了時にTraceCRM基準コミットを固定する。
3. パイロット開始前にCodex CLI、モデル、reasoning、料金表、timeout、評価器を固定する。
4. パイロットで基盤修正が必要になった場合は、新しいmanifest versionを作る。
5. 本実験開始後はsecurity issueを除き依存を更新しない。
6. security updateが必要な場合は実験を停止し、更新後を別versionとして最初から実行する。

## 6. 根拠

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Next.js 16.2 release](https://nextjs.org/blog/next-16-2)
- [Next.js security releases](https://nextjs.org/blog)
- [Prisma system requirements](https://www.prisma.io/docs/orm/reference/system-requirements)
- [Prisma 7 upgrade guide](https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7)
- [Prisma SQLite quickstart](https://www.prisma.io/docs/prisma-orm/quickstart/sqlite)
- [Next.js cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-5.6 Sol model](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [Codex rate card](https://help.openai.com/en/articles/20001106-codex-rate-card)
- [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive)
- [Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md)

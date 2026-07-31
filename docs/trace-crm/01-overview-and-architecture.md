# TraceCRMの概要とアーキテクチャ

## 1. 背景

コーディングエージェントのコスト比較では、Todoアプリのような小規模コードベースでは、対象ファイルが容易に特定でき、プロンプト設計や `AGENTS.md` による探索範囲の差が現れにくい。

一方、大規模OSSをそのまま使用すると、次のノイズが大きくなる。

- 外部サービスへの依存
- 複雑なビルド環境
- 長時間のテスト
- 巨大な既存ルール
- 既存の `AGENTS.md` や設定
- タスク固有の難易度差
- 実験ごとの初期化コスト

そこで、受託開発で一般的な顧客・商談管理システムを題材に、探索経路を選ぶ余地がありながら、実験条件を固定できる中規模アプリを作成する。

---

## 2. 目的

TraceCRMは、業務利用を目的とする本番CRMではなく、以下の実験を再現可能に実施するためのコードベースとする。

1. 通常の短い依頼
2. 構造化プロンプト
3. 最小限の `AGENTS.md` と構造化プロンプト
4. 必要に応じて、過剰な `AGENTS.md`

各条件について、以下を比較する。

- 入力トークン
- キャッシュ済み入力トークン
- 出力トークン
- 消費クレジットまたは料金相当額
- 明示的なファイル参照数
- リポジトリ横断検索回数
- テスト実行回数
- 実行時間
- 変更ファイル数
- タスク成功率
- 不要変更・禁止変更
- 人間による追加修正量

---

## 3. 設計原則

### 3.1 受託開発で理解しやすい業務を選ぶ

対象業務は、顧客、商談、活動履歴、担当者、権限管理とする。

LT参加者が業務仕様の説明を長く聞かなくても、修正・実装タスクの意味を理解できることを重視する。

### 3.2 複数層を明確に分ける

次の層を分離する。

- UI
- API
- 入力検証
- ユースケース
- ドメインルール
- 認可ポリシー
- 永続化
- テスト

この分離により、局所タスク、複数層タスク、横断タスクを自然に作れるようにする。

### 3.3 外部依存を最小化する

以下は使用しない。

- OAuth
- 外部メール送信
- 外部ストレージ
- 外部決済
- 外部AI
- 外部カレンダー
- 外部通知API
- Redis
- Kafka等のメッセージブローカー

すべてローカルで完結させる。

### 3.4 実験ごとに同じ状態へ戻せる

- Git開始コミットを固定する
- SQLite DBを再生成できる
- Seedデータを固定する
- 日時依存を制御する
- 乱数を原則使用しない
- テストが並列実行順に依存しない
- 外部通信を行わない

### 3.5 正解をCodexへ漏らさない

以下はアプリリポジトリへ含めない。

- 正解パッチ
- 隠しテスト
- 期待関連ファイル一覧
- タスク粒度の判定資料
- 人間向け採点表
- 他条件で使用する詳細プロンプト

これらは実験ハーネス側で管理する。

---

## 4. システム概要

### 4.1 システム名

**TraceCRM**

### 4.2 利用者

| ロール | 概要 |
|---|---|
| MEMBER | 一般の営業担当者 |
| MANAGER | チーム管理者 |
| ADMIN | システム管理者 |

### 4.3 主要機能

1. ローカル認証
2. ダッシュボード
3. 顧客管理
4. 商談管理
5. 活動履歴管理
6. タグ管理
7. CSV出力
8. ユーザー管理
9. ロール・認可
10. 操作監査ログ

---

## 5. 技術要件

### 5.1 採用技術

| 項目 | 技術 |
|---|---|
| 言語 | TypeScript 5.9.3 |
| ランタイム | Node.js 24.18.0 LTS |
| パッケージ管理 | pnpm 11.18.0 |
| Webフレームワーク | Next.js 16.2.12 App Router |
| UI | React 19.2.8 |
| CSS | CSS Modules |
| API | Next.js Route Handlers |
| DBアクセス | Prisma 7.9.1 |
| DB | SQLite |
| 入力検証 | Zod 4.4.3 |
| 単体・結合テスト | Vitest 4.1.10 |
| UI・E2E | Playwright 1.62.1 |
| 静的解析 | TypeScript 5.9.3、ESLint 10.8.0 |
| フォーマット | Prettier 3.9.6 |
| バージョン管理 | Git |

完全な固定値、採用理由、代替案は [ADR-0001: TraceCRM技術ベースライン](../decisions/0001-tracecrm-technology-baseline.md) を参照する。

### 5.2 バージョン固定

- `packageManager`を`package.json`へ記載する
- `pnpm-lock.yaml`をコミットする
- Node.jsのバージョンを`.nvmrc`または`.node-version`へ記載する
- 実験開始後は依存パッケージを更新しない
- 各実験結果へGitコミットIDを保存する
- `package.json` の依存バージョンは範囲指定せず完全一致にする
- native buildを許可する依存は `better-sqlite3` のみに限定する

### 5.3 開発コマンド

最低限、以下を提供する。

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm db:reset
pnpm db:seed
pnpm experiment:verify
```

### 5.4 実験用の狭いテストコマンド

Codexが必要な範囲だけテストできるよう、対象別コマンドを提供する。

```bash
pnpm test:customer
pnpm test:deal
pnpm test:activity
pnpm test:auth
pnpm test:audit
```

全テストと対象テストを分けることで、プロンプト条件によるテスト選択の差を測定できるようにする。

---

## 6. アーキテクチャ

### 6.1 採用方針

モノレポにはせず、単一Next.jsアプリ内で層を分離する。

モノレポを避ける理由:

- パッケージ境界による追加ノイズを避ける
- セットアップとテスト時間を短縮する
- Codexが扱う範囲を適度に保つ
- タスク粒度の定義を容易にする

### 6.2 推奨ディレクトリ構成

```text
trace-crm/
├── AGENTS.md                    # P2/P3条件時のみ実験側で配置
├── README.md
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── playwright.config.ts
├── vitest.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
├── scripts/
│   ├── reset-db.ts
│   ├── verify-baseline.ts
│   └── check-forbidden-changes.ts
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── deals/
│   │   ├── activities/
│   │   ├── admin/
│   │   └── api/
│   ├── components/
│   │   ├── common/
│   │   ├── customers/
│   │   ├── deals/
│   │   └── activities/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── presentation/
│   │   ├── customers/
│   │   ├── deals/
│   │   ├── activities/
│   │   ├── users/
│   │   └── audit/
│   ├── shared/
│   │   ├── database/
│   │   ├── errors/
│   │   ├── validation/
│   │   ├── auth/
│   │   ├── time/
│   │   └── csv/
│   └── test/
│       ├── factories/
│       ├── fixtures/
│       └── helpers/
└── tests/
    ├── integration/
    └── e2e/
```

### 6.3 各層の役割

| 層 | 責務 |
|---|---|
| presentation | UI表示、フォーム、HTTPリクエスト変換 |
| application | ユースケース、トランザクション境界 |
| domain | エンティティ、値、業務ルール、認可判断 |
| infrastructure | Prisma、Cookie、ファイル生成等 |
| shared | 機能横断だが業務固有でない処理 |

### 6.4 禁止事項

- UIからPrismaを直接呼ばない
- Route Handlerへ複雑な業務ルールを書かない
- 認可判定を画面表示だけに依存しない
- テスト用分岐を本体コードへ追加しない
- `any`で型エラーを回避しない
- エラーを握りつぶさない

---

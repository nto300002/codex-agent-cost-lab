# 実装・完成計画

## 21. 実装順序

### Phase 1: 基盤

1. Next.js・TypeScript・pnpm初期化
2. Prisma・SQLite
3. Seed・DBリセット
4. 共通エラー
5. Clock
6. テスト基盤
7. CI相当の検証コマンド

### Phase 2: 認証・認可

1. User
2. ローカルログイン
3. セッション
4. Role
5. 認可ポリシー
6. 認証・認可テスト

### Phase 3: Customer

1. Customerドメイン
2. CRUD
3. 一覧・検索
4. UI
5. テスト

### Phase 4: Deal・Activity

1. Deal CRUD・ステージ
2. Activity CRUD
3. Customerとの関係
4. UI
5. テスト

### Phase 5: 管理機能

1. User管理
2. CSV出力
3. AuditLog
4. 管理画面
5. テスト

### Phase 6: 実験対応

1. 基準コミット確定
2. タスクパッチ作成
3. 正解パッチ作成
4. 隠しテスト作成
5. P0/P1/P2作成
6. 実験ハーネス接続
7. パイロット実験

---

## 22. 完成条件

TraceCRMは次を満たした時点で実験用アプリとして完成とする。

- 主要画面・APIが動作する
- G-A、G-B、G-Cの実装・修正タスクを各1件以上作成できる
- 基準コミットですべての公開テストが成功する
- DBを1コマンドで初期化できる
- 外部サービスなしで実行できる
- Codexの各試行を同一コミットから開始できる
- 隠しテストをリポジトリ外から実行できる
- P0/P1/P2を同一タスクへ適用できる
- ファイル参照、テスト回数、トークン、成功率を集計できる
- 全実験条件で同じ環境・評価基準を使用できる

---

## 23. MVP外

- 本番デプロイ
- マルチテナント
- 顧客ごとの組織分離
- OAuth
- メール通知
- プッシュ通知
- ファイルアップロード
- 外部ストレージ
- リアルタイム同期
- WebSocket
- 高度な分析ダッシュボード
- モバイルアプリ
- 多言語対応
- パスワードリセットメール
- 2要素認証
- 商用CRMとしての完全性
- 大規模負荷試験
- アクセシビリティの完全準拠
- Kubernetes等の本番インフラ

---

## 24. 設計判断

未確定事項はISSUE-001で決定した。完全な決定、理由、代替案、固定時点は [ADR-0001: TraceCRM技術ベースライン](../decisions/0001-tracecrm-technology-baseline.md) を参照する。

- Node.js 24.18.0、Next.js 16.2.12、React 19.2.8、pnpm 11.18.0
- TypeScript 5.9.3、Prisma 7.9.1、SQLite adapter
- CSS Modules
- DB管理の不透明セッション、8時間固定期限
- Customerは物理削除し、application層のトランザクションで関連削除とAuditLogを管理
- AuditLog基盤を基準機能として実装し、GC-I1でCustomer・Deal・Activityへ拡張
- G-Aは単体・結合、G-B/G-Cは対象E2Eを成功判定に使用
- 人間時間は同一の熟練エンジニア1名がactive working timeを測定
- G-Cは60分、200 credits/runを警戒上限とする
- Codex CLI 0.144.4、`gpt-5.6-sol`、medium、Fast/Ultraなし
- 新規実装とし、既存テンプレートの暗黙ルールを持ち込まない

---

## 25. 根拠資料

- OpenAI Codex Non-interactive mode
- OpenAI Codex Advanced Configuration
- OpenAI Codex Custom instructions with AGENTS.md
- OpenAI Codex Configuration Reference
- Codexコスト比較実験要件定義

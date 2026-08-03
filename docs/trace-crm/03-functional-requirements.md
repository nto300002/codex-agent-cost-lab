# 機能要件

## 9. 機能要件

## 9.1 ログイン

### 機能

- メールアドレスとパスワードを入力してログイン
- ログアウト
- 未認証時はログイン画面へ遷移
- 無効ユーザーはログイン不可

### エラー

- 認証失敗: 401
- 無効ユーザー: 403
- 入力不備: 400

---

## 9.2 ダッシュボード

### 表示内容

- 担当顧客数
- 進行中商談数
- 今月の受注金額
- 直近の活動履歴
- ステータス別顧客数

MEMBERは自分の担当範囲、MANAGER・ADMINは全体を表示する。

---

## 9.3 顧客管理

### 一覧

- 名前
- ステータス
- 担当者
- メール
- 電話番号
- 更新日時
- タグ

### 検索・絞り込み

- 顧客名の部分一致
- メールアドレスの部分一致
- 電話番号の部分一致
- ステータス
- 担当者
- タグ

一覧APIは `page=1`、`pageSize=20` を既定値とし、1ページあたり最大100件とする。並び順は `updatedAt` の降順、同値の場合は `id` の昇順に固定する。

### 操作

- 登録
- 詳細閲覧
- 編集
- ステータス変更
- 削除
- タグ付与・解除

### 業務ルール

- 顧客名は必須
- 電話番号の空文字はnullとして保存
- 削除前に関連Deal・Activityの扱いを確認する
- MEMBERは担当顧客のみ操作可能
- 削除はADMINのみ可能

---

## 9.4 商談管理

### 一覧

- タイトル
- 顧客
- 金額
- ステージ
- 担当者
- 予定完了日
- 更新日時

### 検索・絞り込み

- 顧客
- ステージ
- 担当者
- 予定完了日の範囲

### 操作

- 登録
- 詳細閲覧
- 編集
- ステージ変更
- 削除

### 業務ルール

- 金額は0以上
- WONまたはLOSTは終了状態
- LOSTからWONへの直接変更は禁止
- MEMBERは自分の担当Dealだけ操作可能
- 削除はMANAGERまたはADMINのみ可能

---

## 9.5 活動履歴

### 操作

- 顧客詳細から活動を登録
- Dealと任意で紐付ける
- 日時、種別、概要を記録
- 顧客単位で時系列表示
- 活動の編集・削除

### 業務ルール

- `occurredAt`は未来日時を許可しない
- Dealを指定する場合、Customerと一致する必要がある
- 登録者を自動記録する

---

## 9.6 CSV出力

### 対象

- 顧客一覧
- 商談一覧

### 権限

- MANAGER
- ADMIN

### 要件

- UTF-8
- ヘッダー行あり
- 現在の絞り込み条件を反映
- 金額は円単位で表示
- CSVインジェクション対策として、危険な先頭文字を適切に処理
- 出力操作をAuditLogへ記録

---

## 9.7 ユーザー管理

### 機能

- ユーザー一覧
- ユーザー追加
- 有効・無効切り替え
- ロール変更

### 制約

- ADMINのみ変更可能
- 自分自身を無効化できない
- 最後のADMINを無効化または降格できない
- 無効ユーザーを新規担当者へ割り当てられない

---

## 9.8 操作監査ログ

### 記録対象

基準実装:

- ログイン・ログアウト
- Userの作成・更新・ロール変更・無効化
- CSV出力
- Customer削除

GC-I1で追加:

- Customerの作成・更新
- Dealの作成・更新・削除
- Activityの作成・更新・削除

### 閲覧

- ADMINのみ
- 新しい順
- Actor、Action、EntityTypeで絞り込み可能

### セキュリティ

- パスワード等を記録しない
- Cookie・Authorizationヘッダーを記録しない
- 大きな値は上限を設ける
- 監査ログ自体の通常UIからの編集・削除は禁止

---

## 10. API要件

### 10.1 共通レスポンス

成功時:

```json
{
  "data": {}
}
```

失敗時:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください",
    "details": {}
  }
}
```

### 10.2 ステータスコード

| 状況 | HTTP |
|---|---:|
| 取得・更新成功 | 200 |
| 作成成功 | 201 |
| 削除成功 | 204 |
| 入力不備 | 400 |
| 未認証 | 401 |
| 権限不足 | 403 |
| 対象なし | 404 |
| 競合 | 409 |
| 想定外 | 500 |

### 10.3 エンドポイント例

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id

GET    /api/deals
POST   /api/deals
GET    /api/deals/:id
PATCH  /api/deals/:id
DELETE /api/deals/:id

GET    /api/customers/:id/activities
POST   /api/customers/:id/activities
PATCH  /api/activities/:id
DELETE /api/activities/:id

GET    /api/users
POST   /api/users
PATCH  /api/users/:id

GET    /api/exports/customers.csv
GET    /api/exports/deals.csv

GET    /api/audit-logs
```

---

## 11. UI要件

### 11.1 画面

| 画面 | URL |
|---|---|
| ログイン | `/login` |
| ダッシュボード | `/dashboard` |
| 顧客一覧 | `/customers` |
| 顧客登録 | `/customers/new` |
| 顧客詳細 | `/customers/[id]` |
| 顧客編集 | `/customers/[id]/edit` |
| 商談一覧 | `/deals` |
| 商談登録 | `/deals/new` |
| 商談詳細 | `/deals/[id]` |
| 商談編集 | `/deals/[id]/edit` |
| ユーザー管理 | `/admin/users` |
| 監査ログ | `/admin/audit-logs` |

### 11.2 UI方針

- 実験の主眼はUIではない
- 視覚効果やアニメーションを最小限にする
- 主要操作は標準HTML要素を中心に実装する
- E2Eテストで安定して選択できるラベルを付ける
- `data-testid`は必要最小限とする
- デスクトップ幅を主対象とする
- 基本的なレスポンシブ対応のみ行う

---

## 12. エラー処理

### 12.1 エラー分類

- ValidationError
- AuthenticationError
- AuthorizationError
- NotFoundError
- ConflictError
- InfrastructureError

### 12.2 要件

- ドメインエラーをHTTPへ変換する層を一か所へ集約
- 生のPrismaエラーを利用者へ返さない
- 500エラーでは内部詳細を表示しない
- テストでステータスコードとエラーコードを検証可能にする

---

## 13. 日時・金額・文字列の規則

### 13.1 日時

- DBはUTC
- UIはAsia/Tokyoとして表示
- テストでは固定Clockを注入可能にする
- `new Date()`の直接利用を業務ロジックから避ける

### 13.2 金額

- DBは`amountCents`相当の整数で保存
- 日本円表示時は整数円へ変換
- 小数の金額は扱わない
- 負数を禁止する

### 13.3 文字列

- 入力の前後空白を除去
- 空文字とnullの扱いを項目ごとに固定
- 検索は大文字・小文字を区別しない
- CSV出力時の改行・引用符を適切に処理する

---

## 14. Seedデータ

### 14.1 規模

| データ | 件数 |
|---|---:|
| User | 4 |
| Customer | 40 |
| Deal | 80 |
| Activity | 160 |
| Tag | 8 |
| AuditLog | 50 |

### 14.2 要件

- IDを固定またはSeedから決定可能にする
- 作成日時を固定範囲で生成する
- 各ロール・ステータス・ステージを網羅する
- 担当者が偏りすぎない
- 境界値データを含む
- 実行ごとに同じデータを生成する

---

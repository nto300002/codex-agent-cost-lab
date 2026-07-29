# ドメインモデルと認証・認可

## 7. データモデル

### 7.1 User

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| email | String | 必須、一意 |
| name | String | 必須、1〜100文字 |
| passwordHash | String | 必須 |
| role | UserRole | MEMBER / MANAGER / ADMIN |
| active | Boolean | 初期値true |
| createdAt | DateTime | 自動 |
| updatedAt | DateTime | 自動 |

### 7.2 Customer

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| name | String | 必須、1〜200文字 |
| email | String? | 任意、有効なメール形式 |
| phone | String? | 任意、空文字はnullへ正規化 |
| status | CustomerStatus | LEAD / ACTIVE / INACTIVE |
| ownerId | String | User参照 |
| notes | String? | 最大2000文字 |
| createdAt | DateTime | 自動 |
| updatedAt | DateTime | 自動 |

### 7.3 Deal

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| customerId | String | Customer参照 |
| title | String | 必須、1〜200文字 |
| amountCents | Int | 0以上 |
| stage | DealStage | NEW / QUALIFIED / PROPOSAL / WON / LOST |
| ownerId | String | User参照 |
| expectedCloseDate | DateTime? | 任意 |
| createdAt | DateTime | 自動 |
| updatedAt | DateTime | 自動 |

金額は浮動小数点ではなく整数の最小通貨単位で保存する。

### 7.4 Activity

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| customerId | String | Customer参照 |
| dealId | String? | Deal参照、任意 |
| type | ActivityType | CALL / EMAIL / MEETING / NOTE |
| summary | String | 必須、1〜1000文字 |
| occurredAt | DateTime | 必須 |
| createdById | String | User参照 |
| createdAt | DateTime | 自動 |
| updatedAt | DateTime | 自動 |

### 7.5 Tag

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| name | String | 必須、一意、1〜50文字 |
| createdAt | DateTime | 自動 |

### 7.6 CustomerTag

| 項目 | 型 | 制約 |
|---|---|---|
| customerId | String | Customer参照 |
| tagId | String | Tag参照 |

複合主キーを設定する。

### 7.7 AuditLog

| 項目 | 型 | 制約 |
|---|---|---|
| id | String | UUID、主キー |
| actorUserId | String | User参照 |
| action | AuditAction | CREATE / UPDATE / DELETE / EXPORT / LOGIN |
| entityType | String | CUSTOMER / DEAL / ACTIVITY / USER |
| entityId | String? | 対象ID |
| beforeJson | String? | 変更前のJSON |
| afterJson | String? | 変更後のJSON |
| createdAt | DateTime | 自動 |

パスワード、Cookie、セッショントークン等の機密情報をログへ含めない。

---

## 8. 認証・認可要件

### 8.1 認証

- メールアドレスとパスワードによるローカル認証
- Cookieベースのセッション
- セッションはSQLiteまたは署名付きCookieで管理
- OAuthは実装しない
- パスワードの平文保存を禁止する
- テスト用ユーザーをSeedで作成する

### 8.2 Seedユーザー

| ロール | メール |
|---|---|
| ADMIN | admin@example.test |
| MANAGER | manager@example.test |
| MEMBER | member1@example.test |
| MEMBER | member2@example.test |

パスワードはすべて実験用の固定値とし、READMEへ記載する。

### 8.3 認可ルール

#### MEMBER

- 自分が担当するCustomerを閲覧・更新できる
- 自分が担当するDealを閲覧・更新できる
- 閲覧可能なCustomerへActivityを登録できる
- User管理は利用できない
- CSV全件出力は利用できない
- 他担当者のCustomer・Dealは原則閲覧できない

#### MANAGER

- 全Customer・Deal・Activityを閲覧できる
- 全Customer・Dealを更新できる
- CSV出力を利用できる
- Userの一覧を閲覧できる
- Userのロール変更はできない

#### ADMIN

- 全機能を利用できる
- Userの有効・無効、ロール変更ができる
- AuditLogを閲覧できる

### 8.4 認可の実装

- API単位で認可する
- UIの非表示だけで保護しない
- 認可ポリシーを`features/auth/domain`へ集約する
- CustomerとDealで重複する認可ロジックを適切に共有する
- 権限エラーはHTTP 403とする
- 未認証はHTTP 401とする

---

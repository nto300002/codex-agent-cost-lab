import { Suspense } from "react";
import { requireSessionUser } from "../../src/features/auth/presentation/session-user";
import { DealList } from "../../src/features/deal/presentation/deal-list";
import { AppShell } from "../../src/shared/presentation/app-shell";
import styles from "../../src/features/deal/presentation/deal.module.css";
export default async function DealsPage() {
  const user = await requireSessionUser();
  return (
    <AppShell user={user}>
      <header className={styles.header}>
        <p>Deals</p>
        <h1>商談一覧</h1>
        <span>顧客に紐づく商談と進捗を管理します。</span>
      </header>
      <Suspense fallback={<p>商談を読み込んでいます…</p>}>
        <DealList />
      </Suspense>
    </AppShell>
  );
}

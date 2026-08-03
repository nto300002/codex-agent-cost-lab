import { Suspense } from "react";

import { requireSessionUser } from "../../src/features/auth/presentation/session-user";
import { CustomerList } from "../../src/features/customer/presentation/customer-list";
import { AppShell } from "../../src/shared/presentation/app-shell";
import styles from "./page.module.css";

export default async function CustomersPage() {
  const user = await requireSessionUser();

  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Customers</p>
        <h1>顧客一覧</h1>
        <span>顧客情報を検索し、担当状況を確認できます。</span>
      </header>
      <Suspense fallback={<p>顧客を読み込んでいます…</p>}>
        <CustomerList user={user} />
      </Suspense>
    </AppShell>
  );
}

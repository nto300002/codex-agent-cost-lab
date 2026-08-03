import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { CustomerDetail } from "../../../src/features/customer/presentation/customer-detail";
import { AppShell } from "../../../src/shared/presentation/app-shell";
import styles from "../page.module.css";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireSessionUser(), params]);

  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Customers</p>
        <h1>顧客詳細</h1>
        <span>登録情報と現在の担当状況を確認できます。</span>
      </header>
      <CustomerDetail user={user} customerId={id} />
    </AppShell>
  );
}

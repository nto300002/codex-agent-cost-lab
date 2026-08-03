import { requireSessionUser } from "../../../../src/features/auth/presentation/session-user";
import { CustomerForm } from "../../../../src/features/customer/presentation/customer-form";
import { AppShell } from "../../../../src/shared/presentation/app-shell";
import styles from "../../page.module.css";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireSessionUser(), params]);

  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Customers</p>
        <h1>顧客編集</h1>
        <span>顧客情報を更新します。</span>
      </header>
      <CustomerForm user={user} customerId={id} />
    </AppShell>
  );
}

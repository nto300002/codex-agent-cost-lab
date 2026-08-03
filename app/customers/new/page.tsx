import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { CustomerForm } from "../../../src/features/customer/presentation/customer-form";
import { AppShell } from "../../../src/shared/presentation/app-shell";
import styles from "../page.module.css";

export default async function NewCustomerPage() {
  const user = await requireSessionUser();

  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Customers</p>
        <h1>顧客登録</h1>
        <span>新しい顧客の基本情報と担当者を登録します。</span>
      </header>
      <CustomerForm user={user} />
    </AppShell>
  );
}

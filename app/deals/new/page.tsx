import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { DealForm } from "../../../src/features/deal/presentation/deal-form";
import { AppShell } from "../../../src/shared/presentation/app-shell";
import styles from "../../../src/features/deal/presentation/deal.module.css";
export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const [user, query] = await Promise.all([requireSessionUser(), searchParams]);
  return (
    <AppShell user={user}>
      <header className={styles.header}>
        <p>Deals</p>
        <h1>商談登録</h1>
        <span>商談の金額、ステージ、担当者を登録します。</span>
      </header>
      <DealForm user={user} initialCustomerId={query.customerId} />
    </AppShell>
  );
}

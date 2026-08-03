import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { DealDetail } from "../../../src/features/deal/presentation/deal-detail";
import { AppShell } from "../../../src/shared/presentation/app-shell";
import styles from "../../../src/features/deal/presentation/deal.module.css";
export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireSessionUser(), params]);
  return (
    <AppShell user={user}>
      <header className={styles.header}>
        <p>Deals</p>
        <h1>商談詳細</h1>
        <span>商談の現在状況を確認できます。</span>
      </header>
      <DealDetail user={user} dealId={id} />
    </AppShell>
  );
}

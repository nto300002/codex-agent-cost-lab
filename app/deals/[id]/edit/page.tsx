import { requireSessionUser } from "../../../../src/features/auth/presentation/session-user";
import { DealForm } from "../../../../src/features/deal/presentation/deal-form";
import { AppShell } from "../../../../src/shared/presentation/app-shell";
import styles from "../../../../src/features/deal/presentation/deal.module.css";
export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireSessionUser(), params]);
  return (
    <AppShell user={user}>
      <header className={styles.header}>
        <p>Deals</p>
        <h1>商談編集</h1>
        <span>商談情報とステージを更新します。</span>
      </header>
      <DealForm user={user} dealId={id} />
    </AppShell>
  );
}

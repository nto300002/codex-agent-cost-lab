import { requireSessionUser } from "../../src/features/auth/presentation/session-user";
import { Dashboard } from "../../src/features/dashboard/presentation/dashboard";
import styles from "../../src/features/dashboard/presentation/dashboard.module.css";
import { AppShell } from "../../src/shared/presentation/app-shell";

export default async function DashboardPage() {
  const user = await requireSessionUser();
  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Dashboard</p>
        <h1>CRMダッシュボード</h1>
        <span>
          {user.role === "MEMBER"
            ? "自分の担当範囲の状況を表示しています。"
            : "CRM全体の状況を表示しています。"}
        </span>
      </header>
      <Dashboard />
    </AppShell>
  );
}

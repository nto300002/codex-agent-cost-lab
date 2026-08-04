import { redirect } from "next/navigation";
import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { UserManagement } from "../../../src/features/user/presentation/user-management";
import styles from "../../../src/features/user/presentation/user-management.module.css";
import { AppShell } from "../../../src/shared/presentation/app-shell";

export default async function AdminUsersPage() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Administration</p>
        <h1>ユーザー管理</h1>
        <span>ユーザーの追加、ロール変更、有効状態を管理します。</span>
      </header>
      <UserManagement actorId={user.id} />
    </AppShell>
  );
}

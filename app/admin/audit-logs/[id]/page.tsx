import { redirect } from "next/navigation";

import { AuditLogDetail } from "../../../../src/features/audit/presentation/audit-log-detail";
import styles from "../../../../src/features/audit/presentation/audit-log.module.css";
import { requireSessionUser } from "../../../../src/features/auth/presentation/session-user";
import { AppShell } from "../../../../src/shared/presentation/app-shell";

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Administration</p>
        <h1>監査ログ詳細</h1>
        <span>記録された操作と変更前後の情報を表示します。</span>
      </header>
      <AuditLogDetail id={id} />
    </AppShell>
  );
}

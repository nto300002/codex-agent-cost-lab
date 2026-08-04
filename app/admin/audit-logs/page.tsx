import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuditLogList } from "../../../src/features/audit/presentation/audit-log-list";
import styles from "../../../src/features/audit/presentation/audit-log.module.css";
import { requireSessionUser } from "../../../src/features/auth/presentation/session-user";
import { AppShell } from "../../../src/shared/presentation/app-shell";

export default async function AuditLogsPage() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return (
    <AppShell user={user}>
      <header className={styles.pageHeader}>
        <p>Administration</p>
        <h1>監査ログ</h1>
        <span>重要操作の実行者と変更履歴を確認できます。</span>
      </header>
      <Suspense fallback={<p>監査ログを読み込んでいます…</p>}>
        <AuditLogList />
      </Suspense>
    </AppShell>
  );
}

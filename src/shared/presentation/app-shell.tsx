import Link from "next/link";
import type { ReactNode } from "react";

import type { AuthenticatedUser } from "../../features/auth/domain/auth-user";
import { LogoutButton } from "../../features/auth/presentation/logout-button";
import styles from "./app-shell.module.css";

export function AppShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          TraceCRM
        </Link>
        <nav aria-label="メインナビゲーション">
          <Link href="/dashboard">概要</Link>
          <Link href="/customers">顧客</Link>
          <Link href="/deals">商談</Link>
        </nav>
        <div className={styles.account}>
          <span>
            {user.name} <small>{user.role}</small>
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

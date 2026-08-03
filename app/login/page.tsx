import { redirect } from "next/navigation";

import { LoginForm } from "../../src/features/auth/presentation/login-form";
import { getOptionalSessionUser } from "../../src/features/auth/presentation/session-user";
import styles from "./page.module.css";

export default async function LoginPage() {
  if (await getOptionalSessionUser()) {
    redirect("/");
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="login-heading">
        <p className={styles.eyebrow}>TraceCRM</p>
        <h1 id="login-heading">ログイン</h1>
        <p className={styles.description}>
          Seedユーザーのメールアドレスとパスワードを入力してください。
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

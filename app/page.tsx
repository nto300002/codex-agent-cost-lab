import styles from "./page.module.css";
import { LogoutButton } from "../src/features/auth/presentation/logout-button";
import { requireSessionUser } from "../src/features/auth/presentation/session-user";

export default async function Home() {
  const user = await requireSessionUser();

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Codex cost experiment</p>
        <h1>TraceCRM</h1>
        <p className={styles.description}>
          プロンプトの情報量とAIエージェントの実装コストを比較するための、再現可能なCRMアプリケーションです。
        </p>
        <dl className={styles.userDetails}>
          <div>
            <dt>ユーザー</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>メール</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>ロール</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
        <LogoutButton />
      </section>
    </main>
  );
}

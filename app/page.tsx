import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Codex cost experiment</p>
        <h1>TraceCRM</h1>
        <p className={styles.description}>
          プロンプトの情報量とAIエージェントの実装コストを比較するための、再現可能なCRMアプリケーションです。
        </p>
        <p className={styles.status}>プロジェクト基盤を初期化しました。</p>
      </section>
    </main>
  );
}

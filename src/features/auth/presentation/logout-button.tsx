"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./logout-button.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function logout() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("ログアウトに失敗しました。もう一度お試しください");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        className={styles.button}
        type="button"
        onClick={logout}
        disabled={submitting}
      >
        {submitting ? "ログアウト中…" : "ログアウト"}
      </button>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import styles from "./login-form.module.css";

type ErrorResponse = {
  error?: { message?: string };
};

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as ErrorResponse;
        setErrorMessage(body.error?.message ?? "ログインに失敗しました");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        <span>メールアドレス</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label>
        <span>パスワード</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}

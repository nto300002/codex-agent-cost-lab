"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { UserRole } from "../../../../generated/prisma/client";
import { userRoles } from "../domain/managed-user";
import { userRequest, userRoleLabels, type ManagedUserView } from "./user-api";
import styles from "./user-management.module.css";

type UserResponse = { data: { user: ManagedUserView } };

export function UserManagement({ actorId }: { actorId: string }) {
  const [users, setUsers] = useState<ManagedUserView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    userRequest<{ data: { users: ManagedUserView[] } }>("/api/admin/users")
      .then(({ data }) => {
        if (active) setUsers(data.users);
      })
      .catch((requestError: unknown) => {
        if (active)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "ユーザーを取得できませんでした",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await userRequest<UserResponse>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
        }),
      });
      setUsers((current) => [...(current ?? []), response.data.user]);
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ユーザーを作成できませんでした",
      );
    } finally {
      setCreating(false);
    }
  }

  function replaceUser(user: ManagedUserView) {
    setUsers(
      (current) =>
        current?.map((item) => (item.id === user.id ? user : item)) ?? null,
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <h2>ユーザーを追加</h2>
        <form
          className={styles.createForm}
          aria-label="ユーザー追加"
          onSubmit={createUser}
        >
          <label>
            <span>名前</span>
            <input name="name" maxLength={100} required />
          </label>
          <label>
            <span>メールアドレス</span>
            <input name="email" type="email" maxLength={254} required />
          </label>
          <label>
            <span>初期パスワード</span>
            <input name="password" type="password" minLength={12} required />
          </label>
          <label>
            <span>ロール</span>
            <select name="role" defaultValue="MEMBER">
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {userRoleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.primary} disabled={creating}>
            {creating ? "追加中…" : "ユーザーを追加"}
          </button>
        </form>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.heading}>
          <h2>ユーザー一覧</h2>
          <span>{users?.length ?? 0}件</span>
        </div>
        {users === null ? (
          <p>ユーザーを読み込んでいます…</p>
        ) : (
          <div className={styles.users}>
            {users.map((user) => (
              <UserEditor
                key={`${user.id}:${user.updatedAt}`}
                user={user}
                isSelf={user.id === actorId}
                onUpdated={replaceUser}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserEditor({
  user,
  isSelf,
  onUpdated,
}: {
  user: ManagedUserView;
  isSelf: boolean;
  onUpdated: (user: ManagedUserView) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function update(payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await userRequest<UserResponse>(
        `/api/admin/users/${user.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      onUpdated(response.data.user);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ユーザーを更新できませんでした",
      );
    } finally {
      setSaving(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return update({
      name,
      email,
      role,
      ...(password.length === 0 ? {} : { password }),
    });
  }

  return (
    <article className={styles.userCard} aria-label={`${user.name}の設定`}>
      <div className={styles.userStatus}>
        <strong>{user.active ? "有効" : "無効"}</strong>
        {isSelf ? <span>ログイン中</span> : null}
      </div>
      <form className={styles.editForm} onSubmit={save}>
        <label>
          <span>名前</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />
        </label>
        <label>
          <span>メールアドレス</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            maxLength={254}
            required
          />
        </label>
        <label>
          <span>ロール</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {userRoles.map((value) => (
              <option key={value} value={value}>
                {userRoleLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>新しいパスワード（任意）</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={12}
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.secondary} disabled={saving}>
            変更を保存
          </button>
          <button
            className={user.active ? styles.danger : styles.secondary}
            type="button"
            disabled={saving || (isSelf && user.active)}
            onClick={() => update({ active: !user.active })}
          >
            {user.active ? "無効にする" : "有効にする"}
          </button>
        </div>
      </form>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

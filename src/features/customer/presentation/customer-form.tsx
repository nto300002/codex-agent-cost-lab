"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { can } from "../../auth/domain/authorization-policy";
import type { CustomerOwner } from "../domain/customer";
import {
  CustomerApiError,
  customerRequest,
  type CustomerView,
} from "./customer-api";
import styles from "./customer.module.css";

type CustomerResponse = { data: { customer: CustomerView } };
type OwnersResponse = { data: { owners: CustomerOwner[] } };

export function CustomerForm({
  user,
  customerId,
}: {
  user: AuthenticatedUser;
  customerId?: string;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [owners, setOwners] = useState<CustomerOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const editing = customerId !== undefined;

  useEffect(() => {
    let active = true;
    const requests: [
      Promise<OwnersResponse>,
      Promise<CustomerResponse | null>,
    ] = [
      customerRequest<OwnersResponse>("/api/customer-owners"),
      customerId
        ? customerRequest<CustomerResponse>(`/api/customers/${customerId}`)
        : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(([ownerResult, customerResult]) => {
        if (active) {
          setOwners(ownerResult.data.owners);
          setCustomer(customerResult?.data.customer ?? null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof CustomerApiError
              ? requestError.message
              : "顧客情報を取得できませんでした",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [customerId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const body = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        status: formData.get("status"),
        ownerId: formData.get("ownerId"),
        notes: formData.get("notes"),
      };
      const response = await customerRequest<CustomerResponse>(
        editing ? `/api/customers/${customerId}` : "/api/customers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      router.push(`/customers/${response.data.customer.id}`);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof CustomerApiError) {
        setError(requestError.message);
        setFieldErrors(requestError.details);
      } else {
        setError("通信に失敗しました。もう一度お試しください");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>顧客情報を読み込んでいます…</p>;
  }

  if (error && editing && customer === null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  const ownerId = customer?.ownerId ?? user.id;
  const permitted = can(user, editing ? "customer:update" : "customer:create", {
    ownerId,
  });

  if (!permitted) {
    return (
      <p className={styles.error} role="alert">
        この顧客を編集する権限がありません。
      </p>
    );
  }

  return (
    <section className={styles.panel}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.fullWidth}>
          <span>顧客名（必須）</span>
          <input
            name="name"
            defaultValue={customer?.name ?? ""}
            maxLength={200}
            required
            autoFocus
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
          {fieldErrors.name ? (
            <span id="name-error" className={styles.fieldError}>
              {fieldErrors.name.join("、")}
            </span>
          ) : null}
        </label>
        <label>
          <span>メールアドレス</span>
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            maxLength={254}
          />
          {fieldErrors.email ? (
            <span className={styles.fieldError}>
              {fieldErrors.email.join("、")}
            </span>
          ) : null}
        </label>
        <label>
          <span>電話番号</span>
          <input
            name="phone"
            type="tel"
            defaultValue={customer?.phone ?? ""}
            maxLength={50}
          />
          {fieldErrors.phone ? (
            <span className={styles.fieldError}>
              {fieldErrors.phone.join("、")}
            </span>
          ) : null}
        </label>
        <label>
          <span>ステータス（必須）</span>
          <select name="status" defaultValue={customer?.status ?? "LEAD"}>
            <option value="LEAD">見込み</option>
            <option value="ACTIVE">取引中</option>
            <option value="INACTIVE">休眠</option>
          </select>
        </label>
        {user.role === "MEMBER" ? (
          <label>
            <span>担当者</span>
            <input value={user.name} disabled />
            <input type="hidden" name="ownerId" value={user.id} />
          </label>
        ) : (
          <label>
            <span>担当者（必須）</span>
            <select name="ownerId" defaultValue={ownerId} required>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.fullWidth}>
          <span>メモ</span>
          <textarea
            name="notes"
            defaultValue={customer?.notes ?? ""}
            maxLength={2000}
          />
          {fieldErrors.notes ? (
            <span className={styles.fieldError}>
              {fieldErrors.notes.join("、")}
            </span>
          ) : null}
        </label>
        {error ? (
          <p className={`${styles.error} ${styles.fullWidth}`} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <button type="submit" disabled={submitting}>
            {submitting ? "保存中…" : editing ? "変更を保存" : "顧客を登録"}
          </button>
          <Link
            className={styles.secondaryLink}
            href={customer ? `/customers/${customer.id}` : "/customers"}
          >
            キャンセル
          </Link>
        </div>
      </form>
    </section>
  );
}

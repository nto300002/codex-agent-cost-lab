"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { can } from "../../auth/domain/authorization-policy";
import {
  CustomerApiError,
  customerRequest,
  customerStatusLabels,
  formatCustomerDate,
  type CustomerView,
} from "./customer-api";
import styles from "./customer.module.css";
import { CustomerDeals } from "../../deal/presentation/customer-deals";

type CustomerResponse = { data: { customer: CustomerView } };

export function CustomerDetail({
  user,
  customerId,
}: {
  user: AuthenticatedUser;
  customerId: string;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    customerRequest<CustomerResponse>(`/api/customers/${customerId}`)
      .then((response) => {
        if (active) setCustomer(response.data.customer);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof CustomerApiError
              ? requestError.message
              : "顧客情報を取得できませんでした",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  async function deleteCustomer() {
    if (!customer || !window.confirm(`${customer.name}を削除しますか？`))
      return;
    setDeleting(true);
    setError(null);

    try {
      await customerRequest<void>(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      router.replace("/customers");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof CustomerApiError
          ? requestError.message
          : "顧客を削除できませんでした",
      );
      setDeleting(false);
    }
  }

  if (error && customer === null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (customer === null) return <p>顧客情報を読み込んでいます…</p>;

  const canUpdate = can(user, "customer:update", {
    ownerId: customer.ownerId,
  });
  const canDelete = can(user, "customer:delete", {
    ownerId: customer.ownerId,
  });

  return (
    <>
      <section className={styles.panel}>
        <h2 className={styles.detailTitle}>{customer.name}</h2>
        <dl className={styles.detailList}>
          <div>
            <dt>ステータス</dt>
            <dd>{customerStatusLabels[customer.status]}</dd>
          </div>
          <div>
            <dt>担当者</dt>
            <dd>{customer.owner?.name ?? customer.ownerId}</dd>
          </div>
          <div>
            <dt>メールアドレス</dt>
            <dd>{customer.email ?? "未登録"}</dd>
          </div>
          <div>
            <dt>電話番号</dt>
            <dd>{customer.phone ?? "未登録"}</dd>
          </div>
          <div className={styles.wide}>
            <dt>タグ</dt>
            <dd>
              {customer.tags?.length
                ? customer.tags.map(({ name }) => name).join("、")
                : "未設定"}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt>メモ</dt>
            <dd>{customer.notes ?? "未登録"}</dd>
          </div>
          <div>
            <dt>登録日時</dt>
            <dd>{formatCustomerDate(customer.createdAt)}</dd>
          </div>
          <div>
            <dt>更新日時</dt>
            <dd>{formatCustomerDate(customer.updatedAt)}</dd>
          </div>
        </dl>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.detailActions}>
          {canUpdate ? (
            <Link
              className={styles.primaryLink}
              href={`/customers/${customer.id}/edit`}
            >
              顧客を編集
            </Link>
          ) : null}
          {canDelete ? (
            <button
              className={styles.dangerButton}
              type="button"
              onClick={deleteCustomer}
              disabled={deleting}
            >
              {deleting ? "削除中…" : "顧客を削除"}
            </button>
          ) : null}
          <Link className={styles.secondaryLink} href="/customers">
            一覧へ戻る
          </Link>
        </div>
      </section>
      <CustomerDeals customerId={customer.id} />
    </>
  );
}

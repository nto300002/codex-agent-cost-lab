"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { can } from "../../auth/domain/authorization-policy";
import type { CustomerOwner } from "../domain/customer";
import {
  CustomerApiError,
  customerRequest,
  customerStatusLabels,
  formatCustomerDate,
  type CustomerView,
} from "./customer-api";
import styles from "./customer.module.css";

type CustomerListResponse = {
  data: {
    customers: CustomerView[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
};

type OwnersResponse = { data: { owners: CustomerOwner[] } };

export function CustomerList({ user }: { user: AuthenticatedUser }) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [result, setResult] = useState<CustomerListResponse["data"] | null>(
    null,
  );
  const [owners, setOwners] = useState<CustomerOwner[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      customerRequest<CustomerListResponse>(
        `/api/customers${query ? `?${query}` : ""}`,
      ),
      customerRequest<OwnersResponse>("/api/customer-owners"),
    ])
      .then(([customers, ownerResult]) => {
        if (active) {
          setResult(customers.data);
          setOwners(ownerResult.data.owners);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof CustomerApiError
              ? requestError.message
              : "顧客一覧を取得できませんでした",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [query]);

  function pageHref(page: number) {
    const parameters = new URLSearchParams(searchParams.toString());
    parameters.set("page", String(page));
    return `/customers?${parameters.toString()}`;
  }

  function exportHref() {
    const parameters = new URLSearchParams(searchParams.toString());
    parameters.delete("page");
    parameters.delete("pageSize");
    const exportQuery = parameters.toString();
    return `/api/exports/customers.csv${exportQuery ? `?${exportQuery}` : ""}`;
  }

  return (
    <>
      <section className={styles.toolbar} aria-label="顧客の検索と絞り込み">
        <form action="/customers" method="get" className={styles.filters}>
          <label>
            <span>顧客名</span>
            <input
              name="name"
              defaultValue={searchParams.get("name") ?? ""}
              placeholder="顧客名を検索"
            />
          </label>
          <label>
            <span>ステータス</span>
            <select
              name="status"
              defaultValue={searchParams.get("status") ?? ""}
            >
              <option value="">すべて</option>
              <option value="LEAD">見込み</option>
              <option value="ACTIVE">取引中</option>
              <option value="INACTIVE">休眠</option>
            </select>
          </label>
          <label>
            <span>担当者</span>
            <select
              key={`${searchParams.get("ownerId") ?? ""}-${owners.length}`}
              name="ownerId"
              defaultValue={searchParams.get("ownerId") ?? ""}
            >
              <option value="">すべて</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="pageSize" value="20" />
          <button type="submit">検索</button>
          <Link className={styles.clearLink} href="/customers">
            条件をクリア
          </Link>
        </form>
        <div className={styles.toolbarActions}>
          {can(user, "customer:export") ? (
            <a className={styles.secondaryLink} href={exportHref()} download>
              CSV出力
            </a>
          ) : null}
          {can(user, "customer:create", { ownerId: user.id }) ? (
            <Link className={styles.primaryLink} href="/customers/new">
              顧客を登録
            </Link>
          ) : null}
        </div>
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {result === null && error === null ? (
        <p className={styles.loading}>顧客を読み込んでいます…</p>
      ) : null}

      {result ? (
        <section className={styles.tableCard} aria-live="polite">
          <div className={styles.tableSummary}>{result.pagination.total}件</div>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th>ステータス</th>
                  <th>担当者</th>
                  <th>連絡先</th>
                  <th>タグ</th>
                  <th>更新日時</th>
                </tr>
              </thead>
              <tbody>
                {result.customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link href={`/customers/${customer.id}`}>
                        {customer.name}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={styles.status}
                        data-status={customer.status}
                      >
                        {customerStatusLabels[customer.status]}
                      </span>
                    </td>
                    <td>{customer.owner?.name ?? customer.ownerId}</td>
                    <td>
                      <span className={styles.contact}>
                        {customer.email ?? "メール未登録"}
                        <small>{customer.phone ?? "電話未登録"}</small>
                      </span>
                    </td>
                    <td>
                      {customer.tags?.length
                        ? customer.tags.map(({ name }) => name).join("、")
                        : "—"}
                    </td>
                    <td>{formatCustomerDate(customer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.customers.length === 0 ? (
            <p className={styles.empty}>条件に一致する顧客はいません。</p>
          ) : null}
          <nav className={styles.pagination} aria-label="顧客一覧のページ">
            {result.pagination.page > 1 ? (
              <Link href={pageHref(result.pagination.page - 1)}>前へ</Link>
            ) : (
              <span>前へ</span>
            )}
            <strong>
              {result.pagination.page} /{" "}
              {Math.max(result.pagination.totalPages, 1)}
            </strong>
            {result.pagination.page < result.pagination.totalPages ? (
              <Link href={pageHref(result.pagination.page + 1)}>次へ</Link>
            ) : (
              <span>次へ</span>
            )}
          </nav>
        </section>
      ) : null}
    </>
  );
}

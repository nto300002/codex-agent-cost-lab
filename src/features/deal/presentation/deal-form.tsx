"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import type { CustomerOwner } from "../../customer/domain/customer";
import type { CustomerView } from "../../customer/presentation/customer-api";
import { can } from "../../auth/domain/authorization-policy";
import { dealStageLabels, dealStages } from "../domain/deal";
import { DealApiError, dealRequest, type DealView } from "./deal-api";
import styles from "./deal.module.css";

type Response = { data: { deal: DealView } };
export function DealForm({
  user,
  dealId,
  initialCustomerId,
}: {
  user: AuthenticatedUser;
  dealId?: string;
  initialCustomerId?: string;
}) {
  const router = useRouter(),
    editing = Boolean(dealId);
  const [deal, setDeal] = useState<DealView | null>(null),
    [owners, setOwners] = useState<CustomerOwner[]>([]),
    [customers, setCustomers] = useState<CustomerView[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [details, setDetails] = useState<Record<string, string[]>>({}),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      dealRequest<{ data: { owners: CustomerOwner[] } }>(
        "/api/customer-owners",
      ),
      dealRequest<{ data: { customers: CustomerView[] } }>(
        "/api/customers?pageSize=100",
      ),
      dealId
        ? dealRequest<Response>(`/api/deals/${dealId}`)
        : Promise.resolve(null),
    ])
      .then(([o, c, d]) => {
        if (active) {
          setOwners(o.data.owners);
          setCustomers(c.data.customers);
          setDeal(d?.data.deal ?? null);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "情報を取得できませんでした",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dealId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setDetails({});
    try {
      const response = await dealRequest<Response>(
        editing ? `/api/deals/${dealId}` : "/api/deals",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerId: f.get("customerId"),
            title: f.get("title"),
            amountCents: f.get("amountCents"),
            stage: f.get("stage"),
            ownerId: f.get("ownerId"),
            expectedCloseDate: f.get("expectedCloseDate"),
          }),
        },
      );
      router.push(`/deals/${response.data.deal.id}`);
    } catch (e) {
      if (e instanceof DealApiError) {
        setError(e.message);
        setDetails(e.details);
      } else setError("通信に失敗しました");
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <p>商談情報を読み込んでいます…</p>;
  if (error && editing && !deal) return <p className={styles.error}>{error}</p>;
  const ownerId = deal?.ownerId ?? user.id;
  if (!can(user, editing ? "deal:update" : "deal:create", { ownerId }))
    return <p className={styles.error}>この商談を編集する権限がありません。</p>;
  const field = (name: string) =>
    details[name] ? (
      <span className={styles.fieldError}>{details[name].join("、")}</span>
    ) : null;
  return (
    <section className={styles.panel}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.wide}>
          <span>タイトル（必須）</span>
          <input
            name="title"
            defaultValue={deal?.title ?? ""}
            required
            autoFocus
            maxLength={200}
          />
          {field("title")}
        </label>
        <label>
          <span>顧客（必須）</span>
          <select
            name="customerId"
            defaultValue={deal?.customerId ?? initialCustomerId ?? ""}
            required
          >
            <option value="">選択してください</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {field("customerId")}
        </label>
        <label>
          <span>担当者（必須）</span>
          {user.role === "MEMBER" ? (
            <>
              <input value={user.name} disabled />
              <input type="hidden" name="ownerId" value={user.id} />
            </>
          ) : (
            <select name="ownerId" defaultValue={ownerId}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          {field("ownerId")}
        </label>
        <label>
          <span>金額（円・必須）</span>
          <input
            name="amountCents"
            type="number"
            min="0"
            step="1"
            defaultValue={deal?.amountCents ?? 0}
            required
          />
          {field("amountCents")}
        </label>
        <label>
          <span>ステージ（必須）</span>
          <select name="stage" defaultValue={deal?.stage ?? "NEW"}>
            {dealStages.map((s) => (
              <option key={s} value={s}>
                {dealStageLabels[s]}
              </option>
            ))}
          </select>
          {field("stage")}
        </label>
        <label>
          <span>予定完了日</span>
          <input
            name="expectedCloseDate"
            type="date"
            defaultValue={deal?.expectedCloseDate?.slice(0, 10) ?? ""}
          />
          {field("expectedCloseDate")}
        </label>
        {error ? (
          <p className={`${styles.error} ${styles.wide}`} role="alert">
            {error}
          </p>
        ) : null}
        <div className={`${styles.actions} ${styles.wide}`}>
          <button className={styles.button} disabled={saving}>
            {saving ? "保存中…" : editing ? "変更を保存" : "商談を登録"}
          </button>
          <Link
            className={styles.secondary}
            href={deal ? `/deals/${deal.id}` : "/deals"}
          >
            キャンセル
          </Link>
        </div>
      </form>
    </section>
  );
}

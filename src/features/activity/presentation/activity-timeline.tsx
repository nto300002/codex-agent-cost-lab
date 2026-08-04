"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { can } from "../../auth/domain/authorization-policy";
import type { DealView } from "../../deal/presentation/deal-api";
import { dealRequest } from "../../deal/presentation/deal-api";
import { activityTypeLabels, activityTypes } from "../domain/activity";
import {
  ActivityApiError,
  activityRequest,
  formatActivityDate,
  toTokyoDateTimeInput,
  tokyoDateTimeToUtc,
  type ActivityView,
} from "./activity-api";
import styles from "./activity.module.css";

type Props = {
  user: AuthenticatedUser;
  customerId: string;
  customerOwnerId: string;
  dealId?: string;
};

export function ActivityTimeline({
  user,
  customerId,
  customerOwnerId,
  dealId,
}: Props) {
  const [activities, setActivities] = useState<ActivityView[] | null>(null);
  const [deals, setDeals] = useState<DealView[]>([]);
  const [editing, setEditing] = useState<ActivityView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      customerId,
      pageSize: "100",
      ...(dealId ? { dealId } : {}),
    });
    Promise.all([
      activityRequest<{ data: { activities: ActivityView[] } }>(
        `/api/activities?${query}`,
      ),
      dealId
        ? Promise.resolve({ data: { deals: [] as DealView[] } })
        : dealRequest<{ data: { deals: DealView[] } }>(
            `/api/deals?customerId=${customerId}&pageSize=100`,
          ),
    ])
      .then(([activityResponse, dealResponse]) => {
        if (!active) return;
        setActivities(activityResponse.data.activities);
        setDeals(dealResponse.data.deals);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "活動履歴を取得できませんでした",
        );
        setActivities([]);
      });
    return () => {
      active = false;
    };
  }, [customerId, dealId, refreshKey]);

  const canCreate = can(user, "activity:create", {
    ownerId: customerOwnerId,
  });
  const canUpdate = can(user, "activity:update", {
    ownerId: customerOwnerId,
  });
  const canDelete = can(user, "activity:delete", {
    ownerId: customerOwnerId,
  });

  function openCreateForm() {
    setEditing(null);
    setDetails({});
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(activity: ActivityView) {
    setEditing(activity);
    setDetails({});
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setFormOpen(false);
    setDetails({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setDetails({});
    try {
      const input = {
        type: form.get("type"),
        summary: form.get("summary"),
        occurredAt: tokyoDateTimeToUtc(String(form.get("occurredAt"))),
      };
      await activityRequest(
        editing ? `/api/activities/${editing.id}` : "/api/activities",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            editing
              ? input
              : {
                  ...input,
                  customerId,
                  dealId: dealId ?? form.get("dealId"),
                },
          ),
        },
      );
      closeForm();
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      if (requestError instanceof ActivityApiError) {
        setError(requestError.message);
        setDetails(requestError.details);
      } else {
        setError("通信に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(activity: ActivityView) {
    if (!window.confirm("この活動を削除しますか？")) return;
    setError(null);
    try {
      await activityRequest(`/api/activities/${activity.id}`, {
        method: "DELETE",
      });
      if (editing?.id === activity.id) closeForm();
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "活動を削除できませんでした",
      );
    }
  }

  const fieldError = (name: string) =>
    details[name] ? (
      <span className={styles.fieldError}>{details[name].join("、")}</span>
    ) : null;

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p>ACTIVITIES</p>
          <h2>活動履歴</h2>
        </div>
        {canCreate && !formOpen ? (
          <button
            className={styles.primary}
            type="button"
            onClick={openCreateForm}
          >
            活動を記録
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <h3>{editing ? "活動を編集" : "新しい活動"}</h3>
          <label>
            <span>種類（必須）</span>
            <select name="type" defaultValue={editing?.type ?? "CALL"}>
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {activityTypeLabels[type]}
                </option>
              ))}
            </select>
            {fieldError("type")}
          </label>
          {!editing && !dealId ? (
            <label>
              <span>関連商談</span>
              <select name="dealId" defaultValue="">
                <option value="">関連なし</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.title}
                  </option>
                ))}
              </select>
              {fieldError("dealId")}
            </label>
          ) : null}
          <label>
            <span>活動日時（Asia/Tokyo・必須）</span>
            <input
              name="occurredAt"
              type="datetime-local"
              required
              defaultValue={toTokyoDateTimeInput(
                editing?.occurredAt ?? new Date().toISOString(),
              )}
            />
            {fieldError("occurredAt")}
          </label>
          <label className={styles.wide}>
            <span>活動内容（必須）</span>
            <textarea
              name="summary"
              rows={4}
              maxLength={1000}
              required
              defaultValue={editing?.summary ?? ""}
            />
            {fieldError("summary")}
          </label>
          {error ? (
            <p className={`${styles.error} ${styles.wide}`} role="alert">
              {error}
            </p>
          ) : null}
          <div className={`${styles.actions} ${styles.wide}`}>
            <button className={styles.primary} disabled={saving}>
              {saving ? "保存中…" : editing ? "変更を保存" : "活動を登録"}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={closeForm}
            >
              キャンセル
            </button>
          </div>
        </form>
      ) : null}

      {error && !formOpen ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {activities === null ? (
        <p>活動履歴を読み込んでいます…</p>
      ) : activities.length === 0 ? (
        <p className={styles.empty}>活動履歴はありません。</p>
      ) : (
        <ol className={styles.timeline}>
          {activities.map((activity) => (
            <li key={activity.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <strong>{activityTypeLabels[activity.type]}</strong>
                <time dateTime={activity.occurredAt}>
                  {formatActivityDate(activity.occurredAt)}
                </time>
              </div>
              <p className={styles.summary}>{activity.summary}</p>
              <div className={styles.meta}>
                <span>
                  記録者: {activity.createdBy?.name ?? activity.createdById}
                </span>
                {activity.deal ? (
                  <Link href={`/deals/${activity.deal.id}`}>
                    商談: {activity.deal.title}
                  </Link>
                ) : null}
              </div>
              {canUpdate || canDelete ? (
                <div className={styles.cardActions}>
                  {canUpdate ? (
                    <button
                      type="button"
                      onClick={() => openEditForm(activity)}
                    >
                      編集
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => deleteActivity(activity)}
                    >
                      削除
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

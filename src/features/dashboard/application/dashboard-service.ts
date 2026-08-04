import type { Clock } from "../../../shared/time/clock";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { authorizationScope } from "../../auth/domain/authorization-policy";
import type { DashboardRepository } from "./dashboard-repository";

export function tokyoMonthRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: "Asia/Tokyo",
  }).formatToParts(now);
  const year = Number(parts.find(({ type }) => type === "year")?.value);
  const month = Number(parts.find(({ type }) => type === "month")?.value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    monthStart: new Date(`${year}-${pad(month)}-01T00:00:00+09:00`),
    nextMonthStart: new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+09:00`),
  };
}

export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly clock: Clock,
  ) {}

  get(actor: AuthenticatedUser) {
    const ownerId = (
      permission: "customer:read" | "deal:read" | "activity:read",
    ) =>
      authorizationScope(actor, permission) === "owned" ? actor.id : undefined;
    return this.repository.summarize({
      customerOwnerId: ownerId("customer:read"),
      dealOwnerId: ownerId("deal:read"),
      activityCustomerOwnerId: ownerId("activity:read"),
      ...tokyoMonthRange(this.clock.now()),
    });
  }
}

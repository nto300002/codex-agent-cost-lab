import type { ActivityType } from "../../activity/domain/activity";
import type { CustomerStatus } from "../../customer/domain/customer";
import type { DealStage } from "../../deal/domain/deal";

export type DashboardActivity = {
  id: string;
  customerId: string;
  dealId: string | null;
  type: ActivityType;
  summary: string;
  occurredAt: Date;
  customer: { id: string; name: string; ownerId: string };
  deal: { id: string; title: string } | null;
  createdBy: { id: string; name: string };
};

export type DashboardSummary = {
  customerCount: number;
  dealCount: number;
  activeDealCount: number;
  wonThisMonthAmountCents: number;
  customerStatusCounts: Record<CustomerStatus, number>;
  dealStageCounts: Record<DealStage, number>;
  recentActivities: DashboardActivity[];
};

export type DashboardCriteria = {
  customerOwnerId?: string;
  dealOwnerId?: string;
  activityCustomerOwnerId?: string;
  monthStart: Date;
  nextMonthStart: Date;
};

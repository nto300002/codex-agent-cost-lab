export const activityTypes = ["CALL", "EMAIL", "MEETING", "NOTE"] as const;

export type ActivityType = (typeof activityTypes)[number];

export const activityTypeLabels: Record<ActivityType, string> = {
  CALL: "電話",
  EMAIL: "メール",
  MEETING: "会議",
  NOTE: "メモ",
};

export type Activity = {
  id: string;
  customerId: string;
  dealId: string | null;
  type: ActivityType;
  summary: string;
  occurredAt: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; name: string; ownerId: string };
  deal?: { id: string; title: string; customerId: string } | null;
  createdBy?: { id: string; name: string };
};

export type ActivityCreateData = Pick<
  Activity,
  "customerId" | "dealId" | "type" | "summary" | "occurredAt" | "createdById"
>;

export type ActivityUpdateData = Partial<
  Pick<Activity, "type" | "summary" | "occurredAt">
>;

export type ActivitySearch = {
  customerId?: string;
  dealId?: string;
  page: number;
  pageSize: number;
};

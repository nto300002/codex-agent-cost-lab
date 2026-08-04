export const dealStages = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;
export type DealStage = (typeof dealStages)[number];

export const dealStageLabels: Record<DealStage, string> = {
  NEW: "新規",
  QUALIFIED: "見込み確認",
  PROPOSAL: "提案中",
  WON: "受注",
  LOST: "失注",
};

const allowedStageTransitions: Record<DealStage, readonly DealStage[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["PROPOSAL", "LOST"],
  PROPOSAL: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export function canTransitionDealStage(from: DealStage, to: DealStage) {
  return from === to || allowedStageTransitions[from].includes(to);
}

export type Deal = {
  id: string;
  customerId: string;
  title: string;
  amountCents: number;
  stage: DealStage;
  ownerId: string;
  expectedCloseDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; name: string };
  owner?: { id: string; name: string };
};

export type DealCreateData = Pick<
  Deal,
  | "customerId"
  | "title"
  | "amountCents"
  | "stage"
  | "ownerId"
  | "expectedCloseDate"
>;
export type DealUpdateData = Partial<DealCreateData>;
export type DealSearch = {
  customerId?: string;
  stage?: DealStage;
  ownerId?: string;
  expectedFrom?: Date;
  expectedTo?: Date;
  page: number;
  pageSize: number;
};

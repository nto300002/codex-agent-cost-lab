export type ExportAuditData = {
  actorUserId: string;
  entityType: "Customer" | "Deal";
  filters: Record<string, unknown>;
  rowCount: number;
};

export interface ExportAuditRepository {
  record(data: ExportAuditData): Promise<void>;
}

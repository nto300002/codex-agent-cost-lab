import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import type { AuditRecorder } from "../../audit/application/audit-log-repository";
import {
  authorizationScope,
  authorize,
} from "../../auth/domain/authorization-policy";
import type { CustomerRepository } from "../../customer/application/customer-repository";
import type { CustomerSearch } from "../../customer/domain/customer";
import type { DealRepository } from "../../deal/application/deal-repository";
import { dealStageLabels, type DealSearch } from "../../deal/domain/deal";
import { createCsv } from "./csv";

export type CustomerExportSearch = Omit<CustomerSearch, "page" | "pageSize">;
export type DealExportSearch = Omit<DealSearch, "page" | "pageSize">;

const customerStatusLabels = {
  LEAD: "見込み",
  ACTIVE: "取引中",
  INACTIVE: "休眠",
} as const;

function date(value: Date | null) {
  return value?.toISOString() ?? "";
}

export class ExportService {
  constructor(
    private readonly customers: Pick<CustomerRepository, "listForExport">,
    private readonly deals: Pick<DealRepository, "listForExport">,
    private readonly audit: AuditRecorder,
  ) {}

  async customersCsv(actor: AuthenticatedUser, search: CustomerExportSearch) {
    authorize(actor, "customer:export");
    const restrictedOwnerId =
      authorizationScope(actor, "customer:read") === "owned"
        ? actor.id
        : undefined;
    const customers = await this.customers.listForExport({
      ...search,
      restrictedOwnerId,
    });
    const csv = createCsv(
      [
        "ID",
        "顧客名",
        "メールアドレス",
        "電話番号",
        "ステータス",
        "担当者",
        "タグ",
        "メモ",
        "作成日時",
        "更新日時",
      ],
      customers.map((customer) => [
        customer.id,
        customer.name,
        customer.email,
        customer.phone,
        customerStatusLabels[customer.status],
        customer.owner?.name ?? customer.ownerId,
        customer.tags?.map(({ name }) => name).join("、") ?? "",
        customer.notes,
        date(customer.createdAt),
        date(customer.updatedAt),
      ]),
    );
    await this.audit.record({
      actorUserId: actor.id,
      action: "EXPORT",
      entityType: "Customer",
      after: {
        filterKeys: Object.keys(search).sort(),
        rowCount: customers.length,
      },
    });
    return csv;
  }

  async dealsCsv(actor: AuthenticatedUser, search: DealExportSearch) {
    authorize(actor, "deal:export");
    const restrictedOwnerId =
      authorizationScope(actor, "deal:read") === "owned" ? actor.id : undefined;
    const deals = await this.deals.listForExport({
      ...search,
      restrictedOwnerId,
    });
    const csv = createCsv(
      [
        "ID",
        "商談名",
        "顧客名",
        "金額（円）",
        "ステージ",
        "担当者",
        "予定完了日",
        "作成日時",
        "更新日時",
      ],
      deals.map((deal) => [
        deal.id,
        deal.title,
        deal.customer?.name ?? deal.customerId,
        deal.amountCents,
        dealStageLabels[deal.stage],
        deal.owner?.name ?? deal.ownerId,
        date(deal.expectedCloseDate),
        date(deal.createdAt),
        date(deal.updatedAt),
      ]),
    );
    await this.audit.record({
      actorUserId: actor.id,
      action: "EXPORT",
      entityType: "Deal",
      after: {
        filterKeys: Object.keys(search).sort(),
        rowCount: deals.length,
      },
    });
    return csv;
  }
}

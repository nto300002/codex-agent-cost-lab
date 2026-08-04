import type {
  Deal,
  DealCreateData,
  DealSearch,
  DealUpdateData,
} from "../domain/deal";

export type DealListCriteria = DealSearch & { restrictedOwnerId?: string };

export interface DealRepository {
  list(criteria: DealListCriteria): Promise<{
    deals: Deal[];
    total: number;
  }>;
  listForExport(
    criteria: Omit<DealListCriteria, "page" | "pageSize">,
  ): Promise<Deal[]>;
  findById(id: string): Promise<Deal | null>;
  activeOwnerExists(ownerId: string): Promise<boolean>;
  findCustomerOwnerId(customerId: string): Promise<string | null>;
  create(data: DealCreateData): Promise<Deal>;
  update(id: string, data: DealUpdateData): Promise<Deal>;
}

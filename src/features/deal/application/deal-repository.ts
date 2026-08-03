import type {
  Deal,
  DealCreateData,
  DealSearch,
  DealUpdateData,
} from "../domain/deal";

export interface DealRepository {
  list(criteria: DealSearch & { restrictedOwnerId?: string }): Promise<{
    deals: Deal[];
    total: number;
  }>;
  findById(id: string): Promise<Deal | null>;
  activeOwnerExists(ownerId: string): Promise<boolean>;
  findCustomerOwnerId(customerId: string): Promise<string | null>;
  create(data: DealCreateData): Promise<Deal>;
  update(id: string, data: DealUpdateData): Promise<Deal>;
}

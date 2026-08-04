import type {
  Activity,
  ActivityCreateData,
  ActivitySearch,
  ActivityUpdateData,
} from "../domain/activity";

export interface ActivityRepository {
  list(
    criteria: ActivitySearch & { restrictedCustomerOwnerId?: string },
  ): Promise<{ activities: Activity[]; total: number }>;
  findById(id: string): Promise<Activity | null>;
  findCustomerOwnerId(customerId: string): Promise<string | null>;
  findDealCustomerId(dealId: string): Promise<string | null>;
  create(data: ActivityCreateData): Promise<Activity>;
  update(id: string, data: ActivityUpdateData): Promise<Activity>;
  delete(id: string): Promise<void>;
}

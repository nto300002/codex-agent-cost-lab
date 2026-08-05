import type {
  Customer,
  CustomerCreateData,
  CustomerOwner,
  CustomerSearch,
  CustomerUpdateData,
} from "../domain/customer";

export type CustomerListCriteria = CustomerSearch & {
  restrictedOwnerId?: string;
};

export type CustomerRelationCounts = {
  customerTags: number;
  activities: number;
  deals: number;
};

export interface CustomerRepository<TTransaction = unknown> {
  list(criteria: CustomerListCriteria): Promise<{
    customers: Customer[];
    total: number;
  }>;
  listForExport(
    criteria: Omit<CustomerListCriteria, "page" | "pageSize">,
  ): Promise<Customer[]>;
  findById(id: string, transaction?: TTransaction): Promise<Customer | null>;
  activeOwnerExists(ownerId: string): Promise<boolean>;
  listActiveOwners(ownerId?: string): Promise<CustomerOwner[]>;
  create(data: CustomerCreateData): Promise<Customer>;
  update(id: string, data: CustomerUpdateData): Promise<Customer>;
  countRelations(
    customerId: string,
    transaction: TTransaction,
  ): Promise<CustomerRelationCounts>;
  deleteCustomerTags(
    customerId: string,
    transaction: TTransaction,
  ): Promise<void>;
  deleteActivities(
    customerId: string,
    transaction: TTransaction,
  ): Promise<void>;
  deleteDeals(customerId: string, transaction: TTransaction): Promise<void>;
  deleteCustomer(customerId: string, transaction: TTransaction): Promise<void>;
}

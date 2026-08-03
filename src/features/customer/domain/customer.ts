export const customerStatuses = ["LEAD", "ACTIVE", "INACTIVE"] as const;

export type CustomerStatus = (typeof customerStatuses)[number];

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  ownerId: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: { id: string; name: string };
  tags?: Array<{ id: string; name: string }>;
};

export type CustomerOwner = { id: string; name: string };

export type CustomerCreateData = Pick<
  Customer,
  "name" | "email" | "phone" | "status" | "ownerId" | "notes"
>;

export type CustomerUpdateData = Partial<CustomerCreateData>;

export type CustomerSearch = {
  name?: string;
  email?: string;
  phone?: string;
  status?: CustomerStatus;
  ownerId?: string;
  page: number;
  pageSize: number;
};

export type CustomerPage = {
  customers: Customer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

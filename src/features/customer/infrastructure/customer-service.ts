import { prisma } from "../../../infrastructure/database/prisma";
import { PrismaTransactionManager } from "../../../infrastructure/database/prisma-transaction-manager";
import { auditLogService } from "../../audit/infrastructure/audit-log-service";
import { CustomerService } from "../application/customer-service";
import { PrismaCustomerRepository } from "./prisma-customer-repository";

export const customerService = new CustomerService(
  new PrismaCustomerRepository(prisma),
  new PrismaTransactionManager(prisma),
  auditLogService,
);
